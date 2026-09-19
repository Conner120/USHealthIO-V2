//! RabbitMQ stream publisher — the original protobuf pubsub path, kept behind `SINK=rabbitmq`.

use super::SinkStats;
use crate::config::RabbitMqConfig;
use crate::model::{InNetworkObject, ProviderReferenceObject};
use crate::kafka::{
    ProtoNegotiatedPriceKafkaMessage, ProtoProcedureKafkaMessage, ProtoProviderMessage,
    ProtoProviderNegotiationKafkaMessage, ProtoProviderObject, ProtoTaxIdentifier,
};
use protobuf::Message;
use rabbitmq_stream_client::{types::ByteCapacity, Environment, NoDedup, Producer};
use std::collections::HashMap;

#[derive(Debug)]
pub struct RabbitMqError {
    pub message: String,
}

pub struct RabbitMqSink {
    producer: Producer<NoDedup>,
    job_id: String,
    provider_map: HashMap<i64, ProtoProviderMessage>,
    buffer: Vec<InNetworkObject>,
    buffered_prices: usize,
    batch_prices: usize,
    messages_sent: u64,
}

impl RabbitMqSink {
    pub async fn new(cfg: &RabbitMqConfig, job_id: &str) -> Result<RabbitMqSink, RabbitMqError> {
        let mut environment = Err(());
        for attempt in 1..=5 {
            match Environment::builder()
                .host(cfg.host.as_str())
                .port(cfg.port)
                .username(cfg.username.as_str())
                .password(cfg.password.as_str())
                .build()
                .await
            {
                Ok(env) => {
                    environment = Ok(env);
                    break;
                }
                Err(e) => eprintln!("rabbitmq connect attempt {}/5 failed: {:?}", attempt, e),
            }
        }
        let environment = environment.map_err(|_| RabbitMqError {
            message: "Failed to create RabbitMQ environment after 5 retries".to_string(),
        })?;

        let stream = format!("in_network_rates-{}", cfg.shard_id);
        let _ = environment
            .stream_creator()
            .max_length(ByteCapacity::GB(cfg.stream_max_length_gb))
            .create(stream.as_str())
            .await;
        let producer = environment
            .producer()
            .build(stream.as_str())
            .await
            .map_err(|e| RabbitMqError {
                message: format!("Failed to create RabbitMQ producer: {:?}", e),
            })?;

        Ok(RabbitMqSink {
            producer,
            job_id: job_id.to_string(),
            provider_map: HashMap::new(),
            buffer: Vec::new(),
            buffered_prices: 0,
            batch_prices: cfg.batch_prices,
            messages_sent: 0,
        })
    }

    pub fn provider_references(
        &mut self,
        refs: &[ProviderReferenceObject],
    ) -> Result<(), RabbitMqError> {
        for provider_reference in refs {
            let mut proto_provider_message = ProtoProviderMessage::new();
            for network_name in provider_reference.network_name.iter() {
                proto_provider_message.network_name.push(network_name.to_string());
            }
            for provider_group in provider_reference.provider_groups.iter() {
                let mut proto_provider_object = ProtoProviderObject::new();
                proto_provider_object
                    .set_npi(provider_group.npi.iter().map(|x| x.to_string()).collect());
                let mut proto_tax_identifier = ProtoTaxIdentifier::new();
                if let Some(bn) = &provider_group.tin.business_name {
                    proto_tax_identifier.set_business_name(bn.clone());
                }
                proto_tax_identifier.set_field_type(provider_group.tin.r#type.to_string());
                proto_tax_identifier.set_value(provider_group.tin.value.clone());
                proto_provider_object.set_tin(proto_tax_identifier);
                proto_provider_message.provider_groups.push(proto_provider_object);
            }
            self.provider_map
                .insert(provider_reference.provider_group_id, proto_provider_message);
        }
        Ok(())
    }

    pub async fn in_network(&mut self, obj: InNetworkObject) -> Result<SinkStats, RabbitMqError> {
        for rate in obj.negotiated_rate.iter() {
            self.buffered_prices += rate.negotiated_prices.len();
        }
        self.buffer.push(obj);
        if self.buffered_prices > self.batch_prices {
            self.flush().await?;
        }
        Ok(self.stats())
    }

    pub async fn flush(&mut self) -> Result<SinkStats, RabbitMqError> {
        if self.buffer.is_empty() {
            return Ok(self.stats());
        }
        let records = std::mem::take(&mut self.buffer);
        let n = records.len();
        let start = std::time::Instant::now();
        let sent = submit_in_network_rabbitmq(records, &self.provider_map, &self.producer, &self.job_id).await?;
        self.messages_sent += sent;
        println!(
            "Submitted {} in_network objects ({} prices) to RabbitMQ in {:.2?} — total messages {}",
            n, self.buffered_prices, start.elapsed(), self.messages_sent
        );
        self.buffered_prices = 0;
        Ok(self.stats())
    }

    pub async fn finish(mut self) -> Result<SinkStats, RabbitMqError> {
        self.flush().await?;
        let stats = self.stats();
        let _ = self.producer.close().await;
        Ok(stats)
    }

    fn stats(&self) -> SinkStats {
        SinkStats { emitted: self.messages_sent }
    }
}

async fn submit_in_network_rabbitmq(
    mut records: Vec<InNetworkObject>,
    provider_map: &HashMap<i64, ProtoProviderMessage>,
    producer: &Producer<NoDedup>,
    job_id: &String,
) -> Result<u64, RabbitMqError> {
    let mut count: u64 = 0;
    let mut messages: Vec<rabbitmq_stream_client::types::Message> = vec![];
    for record in records.drain(..) {
        let mut proto_procedure = ProtoProcedureKafkaMessage::new();
        proto_procedure.set_negotiation_arrangement(record.negotiation_arrangement);
        proto_procedure.set_name(record.name);
        proto_procedure.set_billing_code_type(record.billing_code_type);
        proto_procedure.set_billing_code_type_version(record.billing_code_type_version);
        proto_procedure.set_billing_code(record.billing_code);
        proto_procedure.set_description(record.description);
        for rate in record.negotiated_rate.as_slice() {
            let mut t = ProtoProviderNegotiationKafkaMessage::new();
            t.set_procedure(proto_procedure.clone());
            t.set_insurance_scan_job_id(job_id.clone());
            t.set_provider_group(
                rate.provider_references
                    .iter()
                    .filter_map(|x| {
                        let provider = provider_map.get(x);
                        if provider.is_none() {
                            eprintln!("Provider {} not found in provider_map", x);
                            return None;
                        }
                        let provider = provider.unwrap();
                        let mut prov = ProtoProviderMessage::new();
                        prov.set_network_name(provider.network_name.clone());
                        prov.set_provider_groups(provider.provider_groups.clone());
                        Some(prov)
                    })
                    .collect(),
            );
            t.set_negotiated_prices(
                rate.negotiated_prices
                    .iter()
                    .map(|x| {
                        let mut neg = ProtoNegotiatedPriceKafkaMessage::new();
                        if let Some(v) = &x.negotiated_type {
                            neg.set_negotiated_type(v.clone());
                        }
                        if let Some(v) = x.negotiated_rate {
                            neg.set_negotiated_rate(v);
                        }
                        if let Some(v) = &x.expiration_date {
                            neg.set_expiration_date(v.clone());
                        }
                        if !x.service_code.is_empty() {
                            neg.set_service_code(x.service_code.iter().map(|y| y.to_string()).collect());
                        }
                        if let Some(v) = &x.billing_class {
                            neg.set_billing_class(v.clone());
                        }
                        if let Some(v) = &x.setting {
                            neg.set_setting(v.clone());
                        }
                        if !x.billing_code_modifier.is_empty() {
                            neg.set_billing_code_modifier(
                                x.billing_code_modifier.iter().map(|y| y.to_string()).collect(),
                            );
                        }
                        if !x.additional_information.is_empty() {
                            neg.set_additional_information(
                                x.additional_information.iter().map(|y| y.to_string()).collect(),
                            );
                        }
                        neg
                    })
                    .collect(),
            );
            for chunk in t.provider_group.chunks(50) {
                let mut t_chunk = ProtoProviderNegotiationKafkaMessage::new();
                t_chunk.set_procedure(proto_procedure.clone());
                t_chunk.set_insurance_scan_job_id(job_id.clone());
                t_chunk.set_negotiated_prices(t.negotiated_prices.clone());
                t_chunk.set_provider_group(chunk.iter().cloned().collect());
                let bytes = t_chunk.write_to_bytes().unwrap();
                let message = rabbitmq_stream_client::types::Message::builder()
                    .body(bytes)
                    .application_properties()
                    .insert("id", count.to_string())
                    .message_builder()
                    .build();
                messages.push(message);
                count += 1;
            }
        }
    }
    if messages.is_empty() {
        return Ok(0);
    }
    producer
        .batch_send(messages, |confirmation_status| async move {
            if let Err(e) = confirmation_status {
                eprintln!("Batch send failed: {:?}", e);
            }
        })
        .await
        .map_err(|e| RabbitMqError {
            message: format!("Failed to send batch messages: {:?}", e),
        })?;
    Ok(count)
}

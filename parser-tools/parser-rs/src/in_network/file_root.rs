use std::fs::File;
use std::time::Duration;
use protobuf::Message;
use rdkafka::producer::{BaseRecord, DefaultProducerContext, Producer, ThreadedProducer};
use serde::Serialize;

use struson::reader::{JsonReader, JsonStreamReader};
use crate::create_producer;
use crate::in_network::kafka_messages::{NegotiatedPriceKafkaMessage, ProcedureKafkaMessage, ProviderNegotiationKafkaMessage};
use crate::in_network::types::in_network::{in_network_object, InNetworkObject};
use crate::in_network::types::provider_references::ProviderReferenceObject;
use crate::kafka::{ProtoNegotiatedPriceKafkaMessage, ProtoProcedureKafkaMessage, ProtoProviderNegotiationKafkaMessage};

#[derive(Debug)]
pub struct InNetworkFileError {
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct InNetworkFileRoot {
    pub reporting_entity_name: String,
    pub reporting_entity_type: String,
    pub issuer_name:  Option<String>,
    pub plan_name: Option<String>,
    pub plan_id_type: Option<String>,
    pub plan_id: Option<String>,
    pub plan_sponsor_name: Option<String>,
    pub plan_market_type: Option<String>,
    pub provider_references: Vec<ProviderReferenceObject>,
    pub in_network: Vec<InNetworkObject>,
    pub version: String,
}
pub async  fn in_network_file_root(reader: &mut JsonStreamReader<File>, producer: &ThreadedProducer<DefaultProducerContext>) -> Result<InNetworkFileRoot, InNetworkFileError> {
    let mut data = InNetworkFileRoot {
        reporting_entity_name: String::new(),
        reporting_entity_type: "".to_string(),
        issuer_name: None,
        plan_name: None,
        plan_id_type: None,
        plan_id: None,
        plan_sponsor_name: None,
        plan_market_type: None,
        provider_references: vec![],
        in_network: Vec::new(),
        version: "".to_string(),
    };
    reader.begin_object();
    let mut counter: usize = 0;
    let mut start_time =  std::time::Instant::now();
    loop {
        let has_next = reader.has_next().unwrap();
        if !has_next {
            break;
        }
        let name = reader.next_name().unwrap();
        match name {
            "in_network" => {
                if data.provider_references.is_empty() {
                    eprintln!("Warning: provider_references is empty before processing in_network");
                }
                println!("Processing in_network");
                counter = 0;
                let mut offset = 0;
                start_time = std::time::Instant::now();
                reader.begin_array().unwrap();
                let mut records = vec![];
                loop {
                    let has_next = reader.has_next().unwrap();
                    if !has_next {
                        submit_in_network(records, producer).await;
                        println!("Processed {} in_network objects in {:.2?}, Rate: {:.2} objects/sec", counter, start_time.elapsed(), counter as f64 / start_time.elapsed().as_secs_f64());
                        records = vec![];
                        break;
                    }
                    let in_network = in_network_object(reader).expect("TODO: panic message");
                    counter += in_network.negotiated_rate.len();
                    records.push(in_network);
                    if (counter-offset) > 40000 {
                        let chunk = std::mem::take(&mut records);
                        records = vec![];
                        offset = counter;
                        let start_time_packet = std::time::Instant::now();
                        tokio::spawn(async move {
                            let producer = create_producer();
                            let message_count = submit_in_network(chunk, &producer).await;
                            println!("Submitted {} messages in {:.2?} ({:.2} messages/sec)", message_count, start_time_packet.elapsed(), message_count as f64 / start_time_packet.elapsed().as_secs_f64());
                            println!("Processed {} in_network objects in {:.2?}, Rate: {:.2} objects/sec", counter, start_time.elapsed(), counter as f64 / start_time.elapsed().as_secs_f64());
                        });
                    }
                }
                reader.end_array();
            }
            "reporting_entity_name" => {
                let value = reader.next_string().unwrap();
                data.reporting_entity_name = value.to_string();
            }
            "reporting_entity_type" => {
                let value = reader.next_string().unwrap();
                data.reporting_entity_type = value.to_string();
            }
            "issuer_name" => {
                let value = reader.next_string().unwrap();
                data.issuer_name = Some(value.to_string());
            }
            "plan_name" => {
                let value = reader.next_string().unwrap();
                data.plan_name = Some(value.to_string());
            }
            "plan_id_type" => {
                let value = reader.next_string().unwrap();
                data.plan_id_type = Some(value.to_string());
            }
            "plan_id" => {
                let value = reader.next_string().unwrap();
                data.plan_id = Some(value.to_string());
            }
            "plan_sponsor_name" => {
                let value = reader.next_string().unwrap();
                data.plan_sponsor_name = Some(value.to_string());
            }
            "plan_market_type" => {
                let value = reader.next_string().unwrap();
                data.plan_market_type = Some(value.to_string());
            }
            "provider_references" => {
                counter = 0;
                start_time = std::time::Instant::now();
                reader.begin_array().unwrap();
                loop {
                    let has_next = reader.has_next().unwrap();
                    if !has_next {
                        break;
                    }
                    let item =  crate::in_network::types::provider_references::provider_reference_object(reader)?;
                    counter += 1;
                    data.provider_references.push(item);
                    if counter % 20000 == 0 {
                        let elapsed = start_time.elapsed();
                        data.provider_references = vec![];
                        println!("Processed {} provider_reference objects in {:.2?} ({:.2} objects/sec)", counter, elapsed, counter as f64 / elapsed.as_secs_f64());
                    }
                }
                reader.end_array();
            }
            "version" => {
                let value = reader.next_string().unwrap();
                data.version = value.to_string();
            }
            _ => {
                reader.skip_value().unwrap();
            }
        }
    }
    reader.end_object();
    // print the total time and result size in memory
    println!("Finished processing {} in_network objects in {:.2?}", counter, start_time.elapsed());
    println!("Result size in memory: {} bytes", std::mem::size_of_val(&data));
    println!("number of in_network objects: {}", data.in_network.len());
    Ok(data)
}

async fn submit_in_network(mut records: Vec<InNetworkObject>, producer: &ThreadedProducer<DefaultProducerContext>) ->i64 {
    let mut count = 0;
    let start_time_packet = std::time::Instant::now();
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
            t.set_provider_ids(rate.provider_references.iter().map(|x| x.to_string()).collect());
            t.set_negotiated_prices(rate.negotiated_prices.iter().map(|x| {
                let mut neg = ProtoNegotiatedPriceKafkaMessage::new();
                if x.negotiated_type.is_some() {
                    neg.set_negotiated_type(x.negotiated_type.clone().unwrap());
                }
                if x.negotiated_rate.is_some() {
                    neg.set_negotiated_rate(x.negotiated_rate.unwrap());
                }
                if x.expiration_date.is_some() {
                    neg.set_expiration_date(x.expiration_date.clone().unwrap());
                }
                if !x.service_code.is_empty() {
                    neg.set_service_code(x.service_code.iter().map(|y| y.to_string()).collect());
                }
                if x.billing_class.is_some() {
                    neg.set_billing_class(x.billing_class.clone().unwrap());
                }
                if x.setting.is_some() {
                    neg.set_setting(x.setting.clone().unwrap());
                }
                if !x.billing_code_modifier.is_empty() {
                    neg.set_billing_code_modifier(x.billing_code_modifier.iter().map(|y| y.to_string()).collect());
                }
                if !x.additional_information.is_empty() {
                    neg.set_additional_information(x.additional_information.iter().map(|y| y.to_string()).collect());
                }
                neg
            }).collect());
            let bytes = t.write_to_bytes().unwrap();
            let base_record = BaseRecord::to("topic_name").key(&[])
                .payload(&bytes);
            count+=1;
            match producer.send(base_record) {
                Ok(_) => {},
                Err((e, _)) => eprintln!("Failed to send message: {:?}", e),
            }
        }
    }

    println!("test:{}", start_time_packet.elapsed().as_secs_f64());
    let flush = producer.flush(Duration::from_secs(20));
    if flush.is_err() {
        eprintln!("Failed to flush producer: {:?}", flush.err());
    }else{
        println!("Flushed producer");
    }
    count as i64
}

fn hash_billing_code(billing_code: &str) -> u8 {
    use std::hash::{Hash, Hasher};
    use std::collections::hash_map::DefaultHasher;

    let mut hasher = DefaultHasher::new();
    billing_code.hash(&mut hasher);
    (hasher.finish() % 256) as u8
}
use crate::in_network::types::in_network::{in_network_object, InNetworkObject};
use crate::in_network::types::provider_references::ProviderReferenceObject;
use crate::kafka::{
    ProtoNegotiatedPriceKafkaMessage, ProtoProcedureKafkaMessage, ProtoProviderMessage,
    ProtoProviderNegotiationKafkaMessage, ProtoProviderObject, ProtoTaxIdentifier,
};
use protobuf::Message;
use rabbitmq_stream_client::types::{
    HashRoutingMurmurStrategy, RoutingStrategy, SuperStreamProducer,
};
use rabbitmq_stream_client::{types::ByteCapacity, Environment, NoDedup, Producer};
use rdkafka::producer::{DefaultProducerContext, ThreadedProducer};
use serde::Serialize;
use std::collections::HashMap;
use std::fs::File;
use struson::json_path;
use struson::reader::{JsonReader, JsonStreamReader};

#[derive(Debug)]
pub struct InNetworkFileError {
    pub message: String,
}
fn hash_strategy_value_extractor(message: &rabbitmq_stream_client::types::Message) -> String {
    message
        .application_properties()
        .unwrap()
        .get("id")
        .unwrap()
        .clone()
        .try_into()
        .unwrap()
}
#[derive(Debug, Clone, Serialize)]
pub struct InNetworkFileRoot {
    pub reporting_entity_name: String,
    pub reporting_entity_type: String,
    pub issuer_name: Option<String>,
    pub plan_name: Option<String>,
    pub plan_id_type: Option<String>,
    pub plan_id: Option<String>,
    pub plan_sponsor_name: Option<String>,
    pub plan_market_type: Option<String>,
    pub provider_references: Vec<ProviderReferenceObject>,
    pub in_network: Vec<InNetworkObject>,
    pub version: String,
}
pub async fn in_network_file_root(
    reader: &mut JsonStreamReader<File>,
    producer: &ThreadedProducer<DefaultProducerContext>,
    job_id: &String,
) -> Result<InNetworkFileRoot, InNetworkFileError> {
    let rabbitmq_host = std::env::var("RABBITMQ_HOST").unwrap_or_else(|_| "localhost".to_string());
    let environment = Environment::builder()
        .host(rabbitmq_host.as_str())
        .port(5552)
        .username("guest")
        .password("guest")
        .build()
        .await
        .unwrap();

    println!("creating batch_send stream");
    environment
        .stream_creator()
        .max_length(ByteCapacity::GB(2))
        .create_super_stream("in_network_rates", 5, None)
        .await;

    let mut producer = environment
        .super_stream_producer(RoutingStrategy::HashRoutingStrategy(
            HashRoutingMurmurStrategy {
                routing_extractor: &hash_strategy_value_extractor,
            },
        ))
        .build("in_network_rates")
        .await
        .expect("Failed to create super stream producer");
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
    let mut start_time = std::time::Instant::now();
    let mut need_to_process_in_network_loop_back = false;
    loop {
        if need_to_process_in_network_loop_back && !data.provider_references.is_empty() {
            println!("Looping back to process in_network");
            need_to_process_in_network_loop_back = false;
            reader
                .seek_back(&json_path!["in_network"])
                .expect("TODO: panic message");
        }
        let has_next = reader.has_next().unwrap();
        if !has_next {
            if need_to_process_in_network_loop_back {
                println!("Looping back to process in_network");
                reader
                    .seek_back(&json_path!["in_network"])
                    .expect("TODO: panic message");
            } else {
                break;
            }
        }
        let name = reader.next_name().unwrap();
        match name {
            "in_network" => {
                if data.provider_references.is_empty() && !need_to_process_in_network_loop_back {
                    println!("Warning: provider_references is empty before processing in_network");
                    need_to_process_in_network_loop_back = true;
                    reader.skip_value().unwrap();
                } else {
                    need_to_process_in_network_loop_back = false;
                    let mut provider_map: HashMap<i64, ProtoProviderMessage> = HashMap::new();
                    println!("Processing in_network");
                    counter = 0;
                    let mut offset = 0;
                    start_time = std::time::Instant::now();
                    for provider_reference in data.provider_references.iter() {
                        let mut proto_provider_message = ProtoProviderMessage::new();
                        for network_name in provider_reference.network_name.iter() {
                            proto_provider_message
                                .network_name
                                .push(network_name.to_string());
                        }
                        for provider_group in provider_reference.provider_groups.iter() {
                            let mut proto_provider_object = ProtoProviderObject::new();
                            proto_provider_object.set_npi(
                                provider_group.npi.iter().map(|x| x.to_string()).collect(),
                            );
                            let mut proto_tax_identifier = ProtoTaxIdentifier::new();
                            if provider_group.tins.business_name.is_some() {
                                proto_tax_identifier.set_business_name(
                                    provider_group.tins.business_name.clone().unwrap(),
                                );
                            }
                            proto_tax_identifier
                                .set_field_type(provider_group.tins.r#type.to_string());
                            proto_tax_identifier.set_value(provider_group.tins.value.clone());
                            proto_provider_object.set_tin(proto_tax_identifier);
                            proto_provider_message
                                .provider_groups
                                .push(proto_provider_object);
                        }
                        provider_map
                            .insert(provider_reference.provider_group_id, proto_provider_message);
                    }
                    data.provider_references = vec![];
                    reader.begin_array().unwrap();
                    let mut records = vec![];
                    println!("Processing in_network objects...");
                    loop {
                        let has_next = reader.has_next().unwrap();
                        if !has_next {
                            println!("No more in_network objects to process publishing remaining {} records...", records.len());
                            let provider_map_local = provider_map.clone();
                            let mut producer = producer.clone();
                            submit_in_network_rabbitmq(
                                records,
                                &provider_map_local,
                                &mut producer,
                                &job_id,
                            )
                            .await;
                            println!("Processed {} in_network objects in {:.2?}, Rate: {:.2} objects/sec", counter, start_time.elapsed(), counter as f64 / start_time.elapsed().as_secs_f64());
                            records = vec![];
                            break;
                        }
                        let in_network = in_network_object(reader).expect("TODO: panic message");
                        for rate in in_network.negotiated_rate.iter() {
                            counter += rate.negotiated_prices.len();
                        }
                        records.push(in_network);
                        if (counter - offset) > 400000 {
                            let provider_map_local = provider_map.clone();

                            let start_time_packet = std::time::Instant::now();
                            let job_id_clone = job_id.clone();
                            let message_count = submit_in_network_rabbitmq(
                                records,
                                &provider_map_local,
                                &mut producer,
                                &job_id_clone,
                            )
                            .await;
                            println!(
                                "Submitted {} messages in {:.2?} ({:.2} messages/sec)",
                                message_count,
                                start_time_packet.elapsed(),
                                message_count as f64 / start_time_packet.elapsed().as_secs_f64()
                            );
                            records = vec![];
                            offset = counter;
                        }
                    }
                    reader.end_array();
                }
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
                let mut provider_refs = vec![];
                loop {
                    let has_next = reader.has_next().unwrap();
                    if !has_next {
                        break;
                    }
                    let item =
                        crate::in_network::types::provider_references::provider_reference_object(
                            reader,
                        )
                        .await?;
                    counter += 1;
                    provider_refs.push(item);
                    if counter % 20000 == 0 {
                        let elapsed = start_time.elapsed();
                        println!(
                            "Read {} provider_reference objects in {:.2?} ({:.2} objects/sec)",
                            counter,
                            elapsed,
                            counter as f64 / elapsed.as_secs_f64()
                        );
                    }
                }
                reader.end_array();

                // Process provider references in parallel chunks of 500, including fetching location data
                println!("Processing {} provider_references in parallel chunks of 500 (including location fetches)...", provider_refs.len());
                let fetch_start_time = std::time::Instant::now();
                let chunk_size = 500;
                let mut processed_refs = Vec::with_capacity(provider_refs.len());

                for (chunk_idx, chunk) in provider_refs.chunks(chunk_size).enumerate() {
                    let chunk_start_time = std::time::Instant::now();
                    let mut handles = vec![];

                    // Spawn tasks for this chunk
                    for provider_ref in chunk.iter().cloned() {
                        let handle = tokio::spawn(async move {
                            crate::in_network::types::provider_references::fetch_and_merge_location_data(provider_ref).await
                        });
                        handles.push(handle);
                    }

                    // Wait for all tasks in this chunk to complete
                    for handle in handles {
                        match handle.await {
                            Ok(Ok(provider_ref)) => {
                                processed_refs.push(provider_ref);
                            }
                            Ok(Err(e)) => {
                                eprintln!("Error processing provider reference: {}", e.message);
                                return Err(e);
                            }
                            Err(e) => {
                                eprintln!("Error in parallel task: {:?}", e);
                                return Err(InNetworkFileError {
                                    message: format!("Parallel task error: {:?}", e),
                                });
                            }
                        }
                    }

                    let chunk_elapsed = chunk_start_time.elapsed();
                    let chunk_num = chunk_idx + 1;
                    let total_chunks = (provider_refs.len() + chunk_size - 1) / chunk_size;
                    println!(
                        "Completed chunk {}/{} ({} items) in {:.2?}",
                        chunk_num,
                        total_chunks,
                        chunk.len(),
                        chunk_elapsed
                    );
                }

                data.provider_references = processed_refs;
                let fetch_elapsed = fetch_start_time.elapsed();
                println!("Processed {} provider_reference objects in parallel chunks in {:.2?} ({:.2} objects/sec)", counter, fetch_elapsed, counter as f64 / fetch_elapsed.as_secs_f64());
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
    println!(
        "Finished processing {} in_network objects in {:.2?}",
        counter,
        start_time.elapsed()
    );
    println!(
        "Result size in memory: {} bytes",
        std::mem::size_of_val(&data)
    );
    println!("number of in_network objects: {}", data.in_network.len());
    Ok(data)
}
async fn submit_in_network_rabbitmq(
    mut records: Vec<InNetworkObject>,
    provider_map: &HashMap<i64, ProtoProviderMessage>,
    producer: &mut SuperStreamProducer<NoDedup>,
    job_id: &String,
) -> i64 {
    println!("Connected to rabbitmq stream");
    let mut count = 0;
    let start_time_packet = std::time::Instant::now();
    let mut messages = Vec::<rabbitmq_stream_client::types::Message>::new();
    for record in records.drain(..) {
        let key = format!("{}", record.billing_code);
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
                    .map(|x| {
                        let mut prov = ProtoProviderMessage::new();
                        let provider = provider_map.get(x);
                        if provider.is_none() {
                            eprintln!("Provider {} not found in provider_map", x);
                            return prov;
                        }
                        let provider = provider.unwrap();
                        prov.set_network_name(provider.network_name.clone());
                        prov.set_provider_groups(provider.provider_groups.clone());
                        prov
                    })
                    .collect(),
            );
            t.set_negotiated_prices(
                rate.negotiated_prices
                    .iter()
                    .map(|x| {
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
                            neg.set_service_code(
                                x.service_code.iter().map(|y| y.to_string()).collect(),
                            );
                        }
                        if x.billing_class.is_some() {
                            neg.set_billing_class(x.billing_class.clone().unwrap());
                        }
                        if x.setting.is_some() {
                            neg.set_setting(x.setting.clone().unwrap());
                        }
                        if !x.billing_code_modifier.is_empty() {
                            neg.set_billing_code_modifier(
                                x.billing_code_modifier
                                    .iter()
                                    .map(|y| y.to_string())
                                    .collect(),
                            );
                        }
                        if !x.additional_information.is_empty() {
                            neg.set_additional_information(
                                x.additional_information
                                    .iter()
                                    .map(|y| y.to_string())
                                    .collect(),
                            );
                        }
                        neg
                    })
                    .collect(),
            );
            let chunks = t.provider_group.chunks(50);
            for chunk in chunks {
                let mut t_chunk = ProtoProviderNegotiationKafkaMessage::new();
                t_chunk.set_procedure(proto_procedure.clone());
                t_chunk.set_negotiated_prices(t.negotiated_prices.clone());
                t_chunk.set_provider_group(chunk.iter().map(|x| x.clone()).collect());
                let bytes = t_chunk.write_to_bytes().unwrap();
                let message = rabbitmq_stream_client::types::Message::builder()
                    .body(bytes)
                    .application_properties()
                    .insert("id", count.to_string())
                    .message_builder()
                    .build();
                producer
                    .send(message, |confirmation_status| async move {
                        if confirmation_status.is_ok() {
                            // Message was acknowledged
                        } else {
                            // Message was not acknowledged
                            eprintln!("Message not acknowledged: {:?}", confirmation_status);
                        }
                    })
                    .await
                    .expect("TODO: panic message");

                count += 1;
            }
        }
    }
    println!("test:{}", start_time_packet.elapsed().as_secs_f64());
    count as i64
}

fn hash_billing_code(billing_code: &str) -> u8 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    billing_code.hash(&mut hasher);
    (hasher.finish() % 256) as u8
}

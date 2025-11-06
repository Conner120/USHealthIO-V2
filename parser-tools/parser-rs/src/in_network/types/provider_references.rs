use std::fs::File;
use serde::Serialize;
use struson::reader::{JsonReader, JsonStreamReader};
use struson::reader::simple::{MemberReader, SingleValueReader, ValueReader};
use crate::in_network::file_root::InNetworkFileError;
use crate::in_network::types::in_network::InNetworkObject;
use crate::in_network::types::negotiated_price_object::{negotiated_price_object, NegotiatedPriceObject};
use crate::in_network::types::providers_object::{providers_object, ProvidersObject};

#[derive(Debug, Clone, Serialize)]
pub struct ProviderReferenceObject {
    pub provider_group_id: i64,
    pub network_name: String,
    pub provider_groups: Vec<ProvidersObject>,
}

pub fn provider_reference_object(reader: &mut JsonStreamReader<File>) -> Result<ProviderReferenceObject, InNetworkFileError> {
    let mut data = ProviderReferenceObject {
        provider_group_id: 0,
        network_name: "".to_string(),
        provider_groups: vec![],
    };
    reader.begin_object().expect("TODO: panic message");
    loop {
        if !reader.has_next().unwrap() {
            break;
        }
        let member_name = reader.next_name().unwrap();
        match member_name {
            "provider_group_id" => {
                data.provider_group_id = reader.next_number().unwrap().unwrap();
            }
            "network_name" => {
                data.network_name = reader.next_string().unwrap()
            }
            "provider_groups" => {
                reader.begin_array().unwrap();
                loop {
                    let has_next = reader.has_next().unwrap();
                    if !has_next {
                        break;
                    }
                    let provider_object= providers_object(reader).unwrap();
                    data.provider_groups.push(provider_object);
                }
                reader.end_array();
            }
            _ => {
                reader.skip_value().unwrap();
            }
        }
    }
    reader.end_object().expect("TODO: panic message");
    Ok(data)
}
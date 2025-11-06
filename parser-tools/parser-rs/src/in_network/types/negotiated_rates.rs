use std::fs::File;
use serde::Serialize;
use struson::reader::{JsonReader, JsonStreamReader};
use struson::reader::simple::{MemberReader, SingleValueReader, ValueReader};
use crate::in_network::file_root::InNetworkFileError;
use crate::in_network::types::in_network::InNetworkObject;
use crate::in_network::types::negotiated_price_object::{negotiated_price_object, NegotiatedPriceObject};

#[derive(Debug, Clone, Serialize)]
pub struct NegotiatedRateObject {
    pub negotiated_prices: Vec<NegotiatedPriceObject>,
    pub provider_references: Vec<i64>,
}

pub fn negotiated_rates(reader: &mut JsonStreamReader<File>) -> Result<NegotiatedRateObject, InNetworkFileError> {
    let mut data = NegotiatedRateObject {
        negotiated_prices: Vec::new(),
        provider_references: Vec::new(),
    };
    reader.begin_object();
    while true {
        if !reader.has_next().unwrap() {
            break;
        }
        let member_name = reader.next_name().unwrap();
        match member_name {
            "negotiated_prices" => {
                reader.begin_array().unwrap();
                loop {
                    let has_next = reader.has_next().unwrap();
                    if !has_next {
                        break;
                    }
                    let item = negotiated_price_object(reader)?;
                    data.negotiated_prices.push(item);
                }
                reader.end_array();
            }
            "provider_references" => {
                reader.begin_array().unwrap();
                loop {
                    let has_next = reader.has_next().unwrap();
                    if !has_next {
                        break;
                    }
                    let value = reader.next_number().unwrap().unwrap();
                    data.provider_references.push(value);
                }
                reader.end_array();
            }
            _ => {
                reader.skip_value().unwrap();
            }
        }
    }
    reader.end_object();
    Ok(data)
}
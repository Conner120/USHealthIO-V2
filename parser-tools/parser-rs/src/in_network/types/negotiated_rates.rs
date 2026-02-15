use crate::in_network::file_root::InNetworkFileError;
use crate::in_network::types::in_network::InNetworkObject;
use crate::in_network::types::negotiated_price_object::{
    negotiated_price_object, NegotiatedPriceObject,
};
use serde::Serialize;
use std::fs::File;
use struson::reader::simple::{MemberReader, SingleValueReader, ValueReader};
use struson::reader::{JsonReader, JsonStreamReader};
use crate::in_network::debug::{debug_begin_object, debug_end_object, debug_begin_array, debug_end_array};

#[derive(Debug, Clone, Serialize)]
pub struct NegotiatedRateObject {
    pub negotiated_prices: Vec<NegotiatedPriceObject>,
    pub provider_references: Vec<i64>,
}

pub fn negotiated_rates(
    reader: &mut JsonStreamReader<File>,
) -> Result<NegotiatedRateObject, InNetworkFileError> {
    let mut data = NegotiatedRateObject {
        negotiated_prices: Vec::new(),
        provider_references: Vec::new(),
    };
    debug_begin_object("$.in_network[].negotiated_rates[]");
    reader.begin_object();
    while true {
        if !reader.has_next().unwrap() {
            break;
        }
        let member_name = reader.next_name().unwrap();
        match member_name {
            "negotiated_prices" => {
                debug_begin_array("$.in_network[].negotiated_rates[].negotiated_prices");
                reader.begin_array().unwrap();
                loop {
                    let has_next = reader.has_next().unwrap();
                    if !has_next {
                        break;
                    }
                    let item = negotiated_price_object(reader)?;
                    data.negotiated_prices.push(item);
                }
                debug_end_array("$.in_network[].negotiated_rates[].negotiated_prices");
                reader.end_array();
            }
            "provider_references" => {
                debug_begin_array("$.in_network[].negotiated_rates[].provider_references");
                reader.begin_array().unwrap();
                loop {
                    let has_next = reader.has_next().unwrap();
                    if !has_next {
                        break;
                    }
                    let value = reader.next_number().unwrap().unwrap();
                    data.provider_references.push(value);
                }
                debug_end_array("$.in_network[].negotiated_rates[].provider_references");
                reader.end_array();
            }
            _ => {
                reader.skip_value().unwrap();
            }
        }
    }
    debug_end_object("$.in_network[].negotiated_rates[]");
    reader.end_object();
    Ok(data)
}

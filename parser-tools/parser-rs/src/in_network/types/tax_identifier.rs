use crate::in_network::file_root::InNetworkFileError;
use crate::in_network::types::in_network::InNetworkObject;
use crate::in_network::types::negotiated_price_object::{
    negotiated_price_object, NegotiatedPriceObject,
};
use serde::Serialize;
use std::fs::File;
use struson::reader::simple::{MemberReader, SingleValueReader, ValueReader};
use struson::reader::{JsonReader, JsonStreamReader};
use crate::in_network::debug::{debug_begin_object, debug_end_object};

#[derive(Debug, Clone, Serialize)]
pub struct TaxIdentifierObject {
    pub r#type: String,
    pub value: String,
    pub business_name: Option<String>,
}

pub fn tax_identifier_object(
    reader: &mut JsonStreamReader<File>,
) -> Result<TaxIdentifierObject, InNetworkFileError> {
    let mut data = TaxIdentifierObject {
        r#type: "".to_string(),
        value: "".to_string(),
        business_name: None,
    };
    debug_begin_object("$.provider_references[].provider_groups[].tins");
    reader.begin_object().expect("TODO: panic message");
    loop {
        if !reader.has_next().unwrap() {
            break;
        }
        let member_name = reader.next_name().unwrap();
        match member_name {
            "type" => {
                data.r#type = reader.next_string().unwrap();
            }
            "value" => {
                data.value = reader.next_string().unwrap();
            }
            "business_name" => {
                data.business_name = Some(reader.next_string().unwrap());
            }
            _ => {
                reader.skip_value().unwrap();
            }
        }
    }
    debug_end_object("$.provider_references[].provider_groups[].tins");
    reader.end_object().expect("TODO: panic message");
    Ok(data)
}

pub fn tax_identifier_object_raw(
    reader: &mut JsonStreamReader<&[u8]>,
) -> Result<TaxIdentifierObject, InNetworkFileError> {
    let mut data = TaxIdentifierObject {
        r#type: "".to_string(),
        value: "".to_string(),
        business_name: None,
    };
    debug_begin_object("$.provider_references[].provider_groups[].tins (raw)");
    reader.begin_object().expect("TODO: panic message");
    loop {
        if !reader.has_next().unwrap() {
            break;
        }
        let member_name = reader.next_name().unwrap();
        match member_name {
            "type" => {
                data.r#type = reader.next_string().unwrap();
            }
            "value" => {
                data.value = reader.next_string().unwrap();
            }
            "business_name" => {
                data.business_name = Some(reader.next_string().unwrap());
            }
            _ => {
                reader.skip_value().unwrap();
            }
        }
    }
    debug_end_object("$.provider_references[].provider_groups[].tins (raw)");
    reader.end_object().expect("TODO: panic message");
    Ok(data)
}

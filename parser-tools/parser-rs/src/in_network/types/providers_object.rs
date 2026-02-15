use crate::in_network::file_root::InNetworkFileError;
use crate::in_network::types::in_network::InNetworkObject;
use crate::in_network::types::negotiated_price_object::{
    negotiated_price_object, NegotiatedPriceObject,
};
use crate::in_network::types::tax_identifier::{
    tax_identifier_object, tax_identifier_object_raw, TaxIdentifierObject,
};
use serde::Serialize;
use std::fs::File;
use struson::reader::simple::{MemberReader, SingleValueReader, ValueReader};
use struson::reader::{JsonReader, JsonStreamReader};
use crate::in_network::debug::{debug_begin_object, debug_end_object, debug_begin_array, debug_end_array};

#[derive(Debug, Clone, Serialize)]
pub struct ProvidersObject {
    pub npi: Vec<i64>,
    pub tins: TaxIdentifierObject,
}

pub fn providers_object(
    reader: &mut JsonStreamReader<File>,
) -> Result<ProvidersObject, InNetworkFileError> {
    let mut data = ProvidersObject {
        npi: Vec::new(),
        tins: TaxIdentifierObject {
            r#type: "".to_string(),
            value: "".to_string(),
            business_name: None,
        },
    };
    debug_begin_object("$.provider_references[].provider_groups[]");
    reader.begin_object().expect("TODO: panic message");
    loop {
        if !reader.has_next().unwrap() {
            break;
        }
        let member_name = reader.next_name().unwrap();
        match member_name {
            "npi" => {
                debug_begin_array("$.provider_references[].provider_groups[].npi");
                reader.begin_array().unwrap();
                loop {
                    let has_next = reader.has_next().unwrap();
                    if !has_next {
                        break;
                    }
                    let value = reader.next_number().unwrap().unwrap();
                    data.npi.push(value);
                }
                debug_end_array("$.provider_references[].provider_groups[].npi");
                reader.end_array();
            }
            "tins" => {
                data.tins = tax_identifier_object(reader)?;
            }
            _ => {
                reader.skip_value().unwrap();
            }
        }
    }
    debug_end_object("$.provider_references[].provider_groups[]");
    reader.end_object().expect("TODO: panic message");
    Ok(data)
}

pub fn providers_object_raw(
    reader: &mut JsonStreamReader<&[u8]>,
) -> Result<ProvidersObject, InNetworkFileError> {
    let mut data = ProvidersObject {
        npi: Vec::new(),
        tins: TaxIdentifierObject {
            r#type: "".to_string(),
            value: "".to_string(),
            business_name: None,
        },
    };
    debug_begin_object("$.provider_references[].provider_groups[] (raw)");
    reader.begin_object().expect("TODO: panic message");
    loop {
        if !reader.has_next().unwrap() {
            break;
        }
        let member_name = reader.next_name().unwrap();
        match member_name {
            "npi" => {
                debug_begin_array("$.provider_references[].provider_groups[].npi (raw)");
                reader.begin_array().unwrap();
                loop {
                    let has_next = reader.has_next().unwrap();
                    if !has_next {
                        break;
                    }
                    let value = reader.next_number().unwrap().unwrap();
                    data.npi.push(value);
                }
                debug_end_array("$.provider_references[].provider_groups[].npi (raw)");
                reader.end_array();
            }
            "tins" => {
                data.tins = tax_identifier_object_raw(reader)?;
            }
            "tin" => {
                data.tins = tax_identifier_object_raw(reader)?;
            }
            _ => {
                reader.skip_value().unwrap();
            }
        }
    }
    debug_end_object("$.provider_references[].provider_groups[] (raw)");
    reader.end_object().expect("TODO: panic message");
    Ok(data)
}

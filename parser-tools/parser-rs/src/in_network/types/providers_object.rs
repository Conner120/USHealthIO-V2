use std::fs::File;
use serde::Serialize;
use struson::reader::{JsonReader, JsonStreamReader};
use struson::reader::simple::{MemberReader, SingleValueReader, ValueReader};
use crate::in_network::file_root::InNetworkFileError;
use crate::in_network::types::in_network::InNetworkObject;
use crate::in_network::types::negotiated_price_object::{negotiated_price_object, NegotiatedPriceObject};
use crate::in_network::types::tax_identifier::{tax_identifier_object, TaxIdentifierObject};

#[derive(Debug, Clone, Serialize)]
pub struct ProvidersObject {
    pub npi: Vec<i64>,
    pub tins: TaxIdentifierObject,
}

pub fn providers_object(reader: &mut JsonStreamReader<File>) -> Result<ProvidersObject, InNetworkFileError> {
    let mut data = ProvidersObject {
        npi: Vec::new(),
        tins: TaxIdentifierObject {
            r#type: "".to_string(),
            value: "".to_string(),
            business_name: None,
        },
    };
    reader.begin_object().expect("TODO: panic message");
    loop {
        if !reader.has_next().unwrap() {
            break;
        }
        let member_name = reader.next_name().unwrap();
        match member_name {
            "npi" => {
                reader.begin_array().unwrap();
                loop {
                    let has_next = reader.has_next().unwrap();
                    if !has_next {
                        break;
                    }
                    let value = reader.next_number().unwrap().unwrap();
                    data.npi.push(value);
                }
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
    reader.end_object().expect("TODO: panic message");
    Ok(data)
}
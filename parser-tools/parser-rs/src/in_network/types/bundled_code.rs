use std::fs::File;
use serde::Serialize;
use struson::reader::{JsonReader, JsonStreamReader};
use struson::reader::simple::{MemberReader, SingleValueReader, ValueReader};
use crate::in_network::file_root::InNetworkFileError;
use crate::in_network::types::in_network::InNetworkObject;
use crate::in_network::types::negotiated_price_object::{negotiated_price_object, NegotiatedPriceObject};

#[derive(Debug, Clone, Serialize)]
pub struct BundledCodeObject {
    billing_code_type: String,
    billing_code_type_version: String,
    billing_code: String,
    description: String,
}

pub fn bundled_code_object(reader: &mut JsonStreamReader<File>) -> Result<BundledCodeObject, InNetworkFileError> {
    let mut data = BundledCodeObject {
        billing_code_type: String::new(),
        billing_code_type_version: String::new(),
        billing_code: String::new(),
        description: String::new(),
    };
    reader.begin_object().expect("TODO: panic message");
    loop {
        if !reader.has_next().unwrap() {
            break;
        }
        let member_name = reader.next_name().unwrap();
        match member_name {
            "billing_code_type" => {
                let value = reader.next_string().unwrap();
                data.billing_code_type = value.to_string();
            }
            "billing_code_type_version" => {
                let value = reader.next_string().unwrap();
                data.billing_code_type_version = value.to_string();
            }
            "billing_code" => {
                let value = reader.next_string().unwrap();
                data.billing_code = value.to_string();
            }
            "description" => {
                let value = reader.next_string().unwrap();
                data.description = value.to_string();
            }
            _ => {
                reader.skip_value().unwrap();
            }
        }
    }
    reader.end_object().expect("TODO: panic message");
    Ok(data)
}
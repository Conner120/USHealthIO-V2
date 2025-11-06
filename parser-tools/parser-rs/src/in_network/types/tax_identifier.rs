use std::fs::File;
use serde::Serialize;
use struson::reader::{JsonReader, JsonStreamReader};
use struson::reader::simple::{MemberReader, SingleValueReader, ValueReader};
use crate::in_network::file_root::InNetworkFileError;
use crate::in_network::types::in_network::InNetworkObject;
use crate::in_network::types::negotiated_price_object::{negotiated_price_object, NegotiatedPriceObject};

#[derive(Debug, Clone, Serialize)]
pub struct TaxIdentifierObject {
    pub r#type: String,
    pub value: String,
    pub business_name: Option<String>,
}

pub fn tax_identifier_object(reader: &mut JsonStreamReader<File>) -> Result<TaxIdentifierObject, InNetworkFileError> {
    let mut data = TaxIdentifierObject {
        r#type: "".to_string(),
        value: "".to_string(),
        business_name: None,
    };
    reader.begin_object().expect("TODO: panic message");
    loop {
        if !reader.has_next().unwrap() {
            break;
        }
        let member_name = reader.next_name().unwrap();
        match member_name {
            "type" =>{
                data.r#type = reader.next_string().unwrap();
            }
            "value" =>{
                data.value = reader.next_string().unwrap();
            }
            "business_name" =>{
                data.business_name = Some(reader.next_string().unwrap());
            }
            _ => {
                reader.skip_value().unwrap();
            }
        }
    }
    reader.end_object().expect("TODO: panic message");
    Ok(data)
}
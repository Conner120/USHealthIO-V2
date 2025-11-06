use std::fs::File;
use struson::reader::{JsonReader, JsonStreamReader};
use struson::reader::simple::{MemberReader, SingleValueReader, ValueReader};
use serde::Serialize;
use crate::in_network::file_root::InNetworkFileError;
use crate::in_network::types::bundled_code::{bundled_code_object, BundledCodeObject};
use crate::in_network::types::negotiated_rates::{negotiated_rates, NegotiatedRateObject};

#[derive(Debug, Clone, Serialize )]
pub struct  InNetworkObject {
    pub negotiation_arrangement: String,
    pub name: String,
    pub billing_code_type: String,
    pub billing_code_type_version: String,
    pub severity_of_illness: Option<String>,
    pub billing_code: String,
    pub description: String,
    pub negotiated_rate: Vec<NegotiatedRateObject>,
    pub bundled_codes: Vec<BundledCodeObject>,
    pub covered_services: Vec<BundledCodeObject>,
}
pub fn in_network_object(reader: &mut JsonStreamReader<File>) -> Result<InNetworkObject, InNetworkFileError> {
    let mut data = InNetworkObject {
        negotiation_arrangement: String::new(),
        name: String::new(),
        billing_code_type: String::new(),
        billing_code_type_version: String::new(),
        severity_of_illness: None,
        billing_code: String::new(),
        description: String::new(),
        negotiated_rate: Vec::new(),
        bundled_codes: Vec::new(),
        covered_services: Vec::new(),
    };
    reader.begin_object();
    while true {
        if !reader.has_next().unwrap() {
            break;
        }
        let member_name = reader.next_name().unwrap();
        match member_name {
            "negotiation_arrangement" => {
                data.negotiation_arrangement = reader.next_string().unwrap();
            }
            "name" => {
                data.name = reader.next_string().unwrap();
            }
            "billing_code_type" => {
                data.billing_code_type = reader.next_string().unwrap();
            }
            "billing_code_type_version" => {
                data.billing_code_type_version = reader.next_string().unwrap();
            }
            "severity_of_illness" => {
                data.severity_of_illness = Some(reader.next_string().unwrap());
            }
            "billing_code" => {
                data.billing_code = reader.next_string().unwrap();
            }
            "description" => {
                data.description = reader.next_string().unwrap();
            }
            "negotiated_rates" => {
                reader.begin_array();
                loop {
                    let has_next = reader.has_next().unwrap();
                    if !has_next {
                        break;
                    }
                    let item = negotiated_rates(reader)?;
                    data.negotiated_rate.push(item);
                }
                reader.end_array();
            }
            "bundled_codes" => {
                reader.begin_array();
                loop {
                    let has_next = reader.has_next().unwrap();
                    if !has_next {
                        break;
                    }
                    let item =  bundled_code_object(reader)?;
                    data.bundled_codes.push(item)
                }
                reader.end_array();
            }
            "covered_services" => {
                reader.begin_array();
                loop {
                    let has_next = reader.has_next().unwrap();
                    if !has_next {
                        break;
                    }
                    let item = bundled_code_object(reader)?;
                    data.covered_services.push(item)
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
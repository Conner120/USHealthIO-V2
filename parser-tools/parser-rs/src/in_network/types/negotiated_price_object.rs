use serde::Serialize;
use struson::reader::{JsonReader, JsonStreamReader};
use struson::reader::simple::{MemberReader, SingleValueReader, ValueReader};
use crate::in_network::file_root::InNetworkFileError;


#[derive(Debug, Clone, Serialize)]
pub struct NegotiatedPriceObject {
    pub negotiated_type: Option<String>,
    pub negotiated_rate: Option<f64>,
    pub expiration_date: Option<String>,
    pub service_code: Vec<String>,
    pub billing_class: Option<String>,
    pub setting: Option<String>,
    pub billing_code_modifier: Vec<String>,
    pub additional_information: Vec<String>,
}

pub fn negotiated_price_object(reader: &mut JsonStreamReader<std::fs::File>) -> Result<NegotiatedPriceObject, InNetworkFileError> {
    let mut data = NegotiatedPriceObject {
        negotiated_type: None,
        negotiated_rate: None,
        expiration_date: None,
        service_code: Vec::new(),
        billing_class: None,
        setting: None,
        billing_code_modifier: Vec::new(),
        additional_information: Vec::new(),
    };
    reader.begin_object();
    while true {
        if !reader.has_next().unwrap() {
            break;
        }
        let member_name = reader.next_name().unwrap();
        match member_name {
            "negotiated_type" => {
                let value = reader.next_string().unwrap();
                data.negotiated_type = Some(value.to_string());
            }
            "negotiated_rate" => {
                let value = reader.next_number().unwrap().unwrap();
                data.negotiated_rate = Some(value);
            }
            "expiration_date" => {
                let value = reader.next_string().unwrap();
                data.expiration_date = Some(value.to_string());
            }
            "service_code" => {
                reader.begin_array().unwrap();
                loop {
                    let has_next = reader.has_next().unwrap();
                    if !has_next {
                        break;
                    }
                    let value = reader.next_string().unwrap();
                    data.service_code.push(value.to_string());
                }
                reader.end_array();
            }
            "billing_class" => {
                let value = reader.next_string().unwrap();
                data.billing_class = Some(value.to_string());
            }
            "setting" => {
                let value = reader.next_string().unwrap();
                data.setting = Some(value.to_string());
            }
            "billing_code_modifier" => {
                reader.begin_array().unwrap();
                loop {
                    let has_next = reader.has_next().unwrap();
                    if !has_next {
                        break;
                    }
                    let value = reader.next_string().unwrap();
                    data.billing_code_modifier.push(value.to_string());
                }
                reader.end_array();
            }
            // "additional_information" => {
            //     reader.begin_array().unwrap();
            //     loop {
            //         let has_next = reader.has_next().unwrap();
            //         if !has_next {
            //             break;
            //         }
            //         let value = reader.next_string().unwrap();
            //         data.additional_information.push(value.to_string());
            //     }
            //     reader.end_array();
            // }
            _ => {
                reader.skip_value().unwrap();
            }
        }
    }
    let _ = reader.end_object();
    Ok(data)
}
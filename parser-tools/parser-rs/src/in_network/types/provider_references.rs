use crate::in_network::file_root::InNetworkFileError;
use crate::in_network::types::providers_object::{
    providers_object, providers_object_raw, ProvidersObject,
};
use reqwest::header::{HeaderValue, ACCEPT_ENCODING, USER_AGENT};
use reqwest::Client;
use serde::Serialize;
use std::fs::File;
use struson::reader::{JsonReader, JsonStreamReader};
use crate::in_network::debug::{debug_begin_object, debug_end_object, debug_begin_array, debug_end_array};

#[derive(Debug, Clone, Serialize)]
pub struct ProviderReferenceObject {
    pub provider_group_id: i64,
    pub network_name: Vec<String>,
    pub provider_groups: Vec<ProvidersObject>,
    pub location: Option<String>,
}

pub async fn provider_reference_object(
    reader: &mut JsonStreamReader<File>,
) -> Result<ProviderReferenceObject, InNetworkFileError> {
    let mut data = ProviderReferenceObject {
        provider_group_id: 0,
        network_name: vec![],
        provider_groups: vec![],
        location: None,
    };
    debug_begin_object("$.provider_references[]");
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
                debug_begin_array("$.provider_references[].network_name");
                reader.begin_array().unwrap();
                loop {
                    let has_next = reader.has_next().unwrap();
                    if !has_next {
                        break;
                    }
                    let name = reader.next_string().unwrap();
                    data.network_name.push(name);
                }
                reader.end_array().unwrap();
            }
            "provider_groups" => {
                debug_begin_array("$.provider_references[].provider_groups");
                reader.begin_array().unwrap();
                loop {
                    let has_next = reader.has_next().unwrap();
                    if !has_next {
                        break;
                    }
                    let provider_object = providers_object(reader).unwrap();
                    data.provider_groups.push(provider_object);
                }
                debug_end_array("$.provider_references[].provider_groups");
                reader.end_array();
            }
            "location" => {
                let url = reader.next_string().unwrap();
                data.location = Some(url.to_string());
            }
            _ => {
                reader.skip_value().unwrap();
            }
        }
    }
    debug_end_object("$.provider_references[]");
    reader.end_object().expect("TODO: panic message");
    Ok(data)
}

/// Fetches provider reference data from a location URL and merges it into the existing provider reference add a fetch retry 3 times
pub async fn fetch_and_merge_location_data(
    mut provider_ref: ProviderReferenceObject,
    client: &Client,
) -> Result<ProviderReferenceObject, InNetworkFileError> {
    if let Some(location) = &provider_ref.location {
        let mut failed_attempts = 0;
        loop {
            let response = client
                .get(location)
                .header(USER_AGENT, HeaderValue::from_static("parser-rs/1.0"))
                .header(ACCEPT_ENCODING, HeaderValue::from_static("gzip, br"))
                .send()
                .await
                .map_err(|e| InNetworkFileError {
                    message: format!("Failed to fetch location {}: {}", location, e),
                })?;

            if !response.status().is_success() {
                if failed_attempts > 0 {
                    failed_attempts += 1;
                    // sleep for 1 second before retrying
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                    continue; // Retry fetching
                } else {
                    return Err(InNetworkFileError {
                        message: format!(
                            "Failed to fetch location {}: HTTP {}",
                            location,
                            response.status()
                        ),
                    });
                }
            }

            let bytes = response.bytes().await.map_err(|e| InNetworkFileError {
                message: format!("Failed to read response body from {}: {}", location, e),
            })?;

            // Convert to Vec<u8> to get an owned slice
            let bytes_vec = bytes.to_vec();
            let mut reader = JsonStreamReader::new(bytes_vec.as_slice());
            let fetched_data = provider_reference_object_from_bytes(&mut reader).await?;
            // Merge the fetched data: combine provider_groups and network_name
            provider_ref
                .provider_groups
                .extend(fetched_data.provider_groups);
            // Merge network names, avoiding duplicates
            for network_name in fetched_data.network_name {
                if !provider_ref.network_name.contains(&network_name) {
                    provider_ref.network_name.push(network_name);
                }
            }
            break;
        }
    }
    Ok(provider_ref)
}

/// Parses a ProviderReferenceObject from a byte stream (used for location URLs)
async fn provider_reference_object_from_bytes(
    reader: &mut JsonStreamReader<&[u8]>,
) -> Result<ProviderReferenceObject, InNetworkFileError> {
    let mut data = ProviderReferenceObject {
        provider_group_id: 0,
        network_name: vec![],
        provider_groups: vec![],
        location: None,
    };
    debug_begin_object("$.provider_references[] (raw)");
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
                debug_begin_array("$.provider_references[].network_name (raw)");
                reader.begin_array().unwrap();
                loop {
                    let has_next = reader.has_next().unwrap();
                    if !has_next {
                        break;
                    }
                    let name = reader.next_string().unwrap();
                    data.network_name.push(name);
                }
            }
            "provider_groups" => {
                debug_begin_array("$.provider_references[].provider_groups (raw)");
                reader.begin_array().unwrap();
                loop {
                    let has_next = reader.has_next().unwrap();
                    if !has_next {
                        break;
                    }
                    let provider_object = providers_object_raw(reader).unwrap();
                    data.provider_groups.push(provider_object);
                }
                debug_end_array("$.provider_references[].provider_groups (raw)");
                reader.end_array();
            }
            "location" => {
                let url = reader.next_string().unwrap();
                data.location = Some(url.to_string());
            }
            _ => {
                reader.skip_value().unwrap();
            }
        }
    }
    debug_end_object("$.provider_references[] (raw)");
    reader.end_object().expect("TODO: panic message");
    Ok(data)
}

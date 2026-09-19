//! Resolves `provider_references[].location` URLs (out-of-line provider groups) and merges the
//! fetched groups into the referencing object.

use crate::model::ProviderReferenceObject;
use reqwest::header::{HeaderValue, ACCEPT_ENCODING, USER_AGENT};
use reqwest::Client;

pub fn http_client() -> Client {
    Client::builder()
        .gzip(true)
        .brotli(true)
        .build()
        .expect("failed to build HTTP client")
}

pub async fn resolve_location(
    mut provider_ref: ProviderReferenceObject,
    client: &Client,
    retries: u32,
) -> Result<ProviderReferenceObject, String> {
    let Some(location) = provider_ref.location.clone() else {
        return Ok(provider_ref);
    };
    let mut attempt = 0;
    let bytes = loop {
        attempt += 1;
        let result = client
            .get(&location)
            .header(USER_AGENT, HeaderValue::from_static("parser-rs/1.0"))
            .header(ACCEPT_ENCODING, HeaderValue::from_static("gzip, br"))
            .send()
            .await;
        match result {
            Ok(resp) if resp.status().is_success() => match resp.bytes().await {
                Ok(b) => break b,
                Err(e) if attempt <= retries => {
                    eprintln!("location {} body read failed (attempt {}): {}", location, attempt, e)
                }
                Err(e) => return Err(format!("Failed to read body from {}: {}", location, e)),
            },
            Ok(resp) if attempt <= retries => {
                eprintln!("location {} HTTP {} (attempt {})", location, resp.status(), attempt)
            }
            Ok(resp) => return Err(format!("Failed to fetch {}: HTTP {}", location, resp.status())),
            Err(e) if attempt <= retries => {
                eprintln!("location {} request failed (attempt {}): {}", location, attempt, e)
            }
            Err(e) => return Err(format!("Failed to fetch {}: {}", location, e)),
        }
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    };
    let fetched: ProviderReferenceObject = serde_json::from_slice(&bytes)
        .map_err(|e| format!("Failed to parse location {}: {}", location, e))?;
    provider_ref.provider_groups.extend(fetched.provider_groups);
    for network_name in fetched.network_name {
        if !provider_ref.network_name.contains(&network_name) {
            provider_ref.network_name.push(network_name);
        }
    }
    if provider_ref.provider_group_id == 0 && fetched.provider_group_id != 0 {
        provider_ref.provider_group_id = fetched.provider_group_id;
    }
    Ok(provider_ref)
}

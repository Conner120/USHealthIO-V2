//! Data model for MRF in-network files, deserialized per element with serde_json.
//! Tolerant of the carrier-specific variations seen in the wild:
//!   * `tin` vs `tins`
//!   * NPI as number or string
//!   * `business_name` null
//!   * `additional_information` as string or array

use serde::de::{self, Deserializer, SeqAccess, Visitor};
use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Default, Serialize)]
pub struct FileHeader {
    pub reporting_entity_name: String,
    pub reporting_entity_type: String,
    pub issuer_name: Option<String>,
    pub plan_name: Option<String>,
    pub plan_id_type: Option<String>,
    pub plan_id: Option<String>,
    pub plan_sponsor_name: Option<String>,
    pub plan_market_type: Option<String>,
    pub version: String,
}

impl FileHeader {
    /// Called by the scanner for each top-level string member.
    pub fn set(&mut self, key: &str, value: String) {
        match key {
            "reporting_entity_name" => self.reporting_entity_name = value,
            "reporting_entity_type" => self.reporting_entity_type = value,
            "issuer_name" => self.issuer_name = Some(value),
            "plan_name" => self.plan_name = Some(value),
            "plan_id_type" => self.plan_id_type = Some(value),
            "plan_id" => self.plan_id = Some(value),
            "plan_sponsor_name" => self.plan_sponsor_name = Some(value),
            "plan_market_type" => self.plan_market_type = Some(value),
            "version" => self.version = value,
            _ => {}
        }
    }
}

// ---------------------------------------------------------------- provider_references[]

#[derive(Debug, Clone, Deserialize)]
pub struct ProviderReferenceObject {
    #[serde(default)]
    pub provider_group_id: i64,
    #[serde(default)]
    pub network_name: Vec<String>,
    #[serde(default)]
    pub provider_groups: Vec<ProvidersObject>,
    #[serde(default)]
    pub location: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProvidersObject {
    #[serde(default, deserialize_with = "de_i64_list")]
    pub npi: Vec<i64>,
    #[serde(default, alias = "tins")]
    pub tin: TaxIdentifierObject,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct TaxIdentifierObject {
    #[serde(default)]
    pub r#type: String,
    #[serde(default, deserialize_with = "de_string_lossy")]
    pub value: String,
    #[serde(default)]
    pub business_name: Option<String>,
}

// ---------------------------------------------------------------- in_network[]

#[derive(Debug, Clone, Deserialize)]
pub struct InNetworkObject {
    #[serde(default)]
    pub negotiation_arrangement: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub billing_code_type: String,
    #[serde(default, deserialize_with = "de_string_lossy")]
    pub billing_code_type_version: String,
    #[serde(default)]
    pub severity_of_illness: Option<String>,
    #[serde(default, deserialize_with = "de_string_lossy")]
    pub billing_code: String,
    #[serde(default)]
    pub description: String,
    #[serde(default, rename = "negotiated_rates")]
    pub negotiated_rate: Vec<NegotiatedRateObject>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NegotiatedRateObject {
    #[serde(default)]
    pub negotiated_prices: Vec<NegotiatedPriceObject>,
    #[serde(default, deserialize_with = "de_i64_list")]
    pub provider_references: Vec<i64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NegotiatedPriceObject {
    #[serde(default)]
    pub negotiated_type: Option<String>,
    #[serde(default)]
    pub negotiated_rate: Option<f64>,
    #[serde(default)]
    pub expiration_date: Option<String>,
    #[serde(default, deserialize_with = "de_string_list")]
    pub service_code: Vec<String>,
    #[serde(default)]
    pub billing_class: Option<String>,
    #[serde(default)]
    pub setting: Option<String>,
    #[serde(default, deserialize_with = "de_string_list")]
    pub billing_code_modifier: Vec<String>,
    #[serde(default, deserialize_with = "de_string_list")]
    pub additional_information: Vec<String>,
}

// ---------------------------------------------------------------- lenient deserializers

/// Accepts `123`, `"123"`, or a list mixing both. Non-numeric strings are dropped.
fn de_i64_list<'de, D: Deserializer<'de>>(d: D) -> Result<Vec<i64>, D::Error> {
    struct V;
    impl<'de> Visitor<'de> for V {
        type Value = Vec<i64>;
        fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
            f.write_str("an integer, a numeric string, or a list of them")
        }
        fn visit_i64<E: de::Error>(self, v: i64) -> Result<Vec<i64>, E> {
            Ok(vec![v])
        }
        fn visit_u64<E: de::Error>(self, v: u64) -> Result<Vec<i64>, E> {
            Ok(vec![v as i64])
        }
        fn visit_f64<E: de::Error>(self, v: f64) -> Result<Vec<i64>, E> {
            Ok(vec![v as i64])
        }
        fn visit_str<E: de::Error>(self, v: &str) -> Result<Vec<i64>, E> {
            Ok(v.trim().parse::<i64>().map(|n| vec![n]).unwrap_or_default())
        }
        fn visit_none<E: de::Error>(self) -> Result<Vec<i64>, E> {
            Ok(vec![])
        }
        fn visit_unit<E: de::Error>(self) -> Result<Vec<i64>, E> {
            Ok(vec![])
        }
        fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Vec<i64>, A::Error> {
            #[derive(Deserialize)]
            #[serde(untagged)]
            enum Item {
                I(i64),
                F(f64),
                S(String),
                Other(serde::de::IgnoredAny),
            }
            let mut out = Vec::with_capacity(seq.size_hint().unwrap_or(0));
            while let Some(item) = seq.next_element::<Item>()? {
                match item {
                    Item::I(n) => out.push(n),
                    Item::F(f) => out.push(f as i64),
                    Item::S(s) => {
                        if let Ok(n) = s.trim().parse::<i64>() {
                            out.push(n)
                        }
                    }
                    Item::Other(_) => {}
                }
            }
            Ok(out)
        }
    }
    d.deserialize_any(V)
}

/// Accepts a string, a number, null, or a list of strings/numbers.
fn de_string_list<'de, D: Deserializer<'de>>(d: D) -> Result<Vec<String>, D::Error> {
    struct V;
    impl<'de> Visitor<'de> for V {
        type Value = Vec<String>;
        fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
            f.write_str("a string or a list of strings")
        }
        fn visit_str<E: de::Error>(self, v: &str) -> Result<Vec<String>, E> {
            Ok(vec![v.to_string()])
        }
        fn visit_i64<E: de::Error>(self, v: i64) -> Result<Vec<String>, E> {
            Ok(vec![v.to_string()])
        }
        fn visit_u64<E: de::Error>(self, v: u64) -> Result<Vec<String>, E> {
            Ok(vec![v.to_string()])
        }
        fn visit_f64<E: de::Error>(self, v: f64) -> Result<Vec<String>, E> {
            Ok(vec![v.to_string()])
        }
        fn visit_none<E: de::Error>(self) -> Result<Vec<String>, E> {
            Ok(vec![])
        }
        fn visit_unit<E: de::Error>(self) -> Result<Vec<String>, E> {
            Ok(vec![])
        }
        fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Vec<String>, A::Error> {
            #[derive(Deserialize)]
            #[serde(untagged)]
            enum Item {
                S(String),
                I(i64),
                F(f64),
                Other(serde::de::IgnoredAny),
            }
            let mut out = Vec::with_capacity(seq.size_hint().unwrap_or(0));
            while let Some(item) = seq.next_element::<Item>()? {
                match item {
                    Item::S(s) => out.push(s),
                    Item::I(n) => out.push(n.to_string()),
                    Item::F(f) => out.push(f.to_string()),
                    Item::Other(_) => {}
                }
            }
            Ok(out)
        }
    }
    d.deserialize_any(V)
}

/// Accepts a string or a number (some carriers emit numeric billing codes / TINs unquoted).
fn de_string_lossy<'de, D: Deserializer<'de>>(d: D) -> Result<String, D::Error> {
    struct V;
    impl<'de> Visitor<'de> for V {
        type Value = String;
        fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
            f.write_str("a string or number")
        }
        fn visit_str<E: de::Error>(self, v: &str) -> Result<String, E> {
            Ok(v.to_string())
        }
        fn visit_string<E: de::Error>(self, v: String) -> Result<String, E> {
            Ok(v)
        }
        fn visit_i64<E: de::Error>(self, v: i64) -> Result<String, E> {
            Ok(v.to_string())
        }
        fn visit_u64<E: de::Error>(self, v: u64) -> Result<String, E> {
            Ok(v.to_string())
        }
        fn visit_f64<E: de::Error>(self, v: f64) -> Result<String, E> {
            Ok(v.to_string())
        }
        fn visit_none<E: de::Error>(self) -> Result<String, E> {
            Ok(String::new())
        }
        fn visit_unit<E: de::Error>(self) -> Result<String, E> {
            Ok(String::new())
        }
    }
    d.deserialize_any(V)
}

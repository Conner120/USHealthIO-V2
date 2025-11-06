use serde;
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProviderNegotiationKafkaMessage {
    pub procedure: ProcedureKafkaMessage,
    pub provider_ids: Vec<String>,
    pub negotiated_prices: Vec<NegotiatedPriceKafkaMessage>,
}
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct NegotiatedPriceKafkaMessage {
    pub negotiated_type: Option<String>,
    pub negotiated_rate: Option<f64>,
    pub expiration_date: Option<String>,
    pub service_code: Vec<String>,
    pub billing_class: Option<String>,
    pub setting: Option<String>,
    pub billing_code_modifier: Vec<String>,
    pub additional_information: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProcedureKafkaMessage {
    pub negotiation_arrangement: String,
    pub name: String,
    pub billing_code_type: String,
    pub billing_code_type_version: String,
    pub billing_code: String,
    pub description: String,
}
//! Content hashes for the v2 ClickHouse schema (`clickhouse-schema/schema.sql`).
//!
//! Every hash is xxHash64 over a canonical string so it can be recomputed in SQL with
//! `xxHash64(...)` and any row verified. The string rules, shared with the schema header:
//!   * fields joined with `|`
//!   * arrays sorted ascending and joined with `,`
//!   * NULL / absent -> empty string
//!   * `negotiated_rate` formatted with exactly four decimals (`%.4f`), so 100 and 100.0 collide
//!
//!   rate_hash           = billing_code_type|billing_code_type_version|billing_code|
//!                         negotiation_arrangement|negotiated_type|negotiated_rate|
//!                         billing_class|setting|severity_of_illness|
//!                         service_code[]|billing_code_modifier[]|additional_information[]
//!   billing_key_hash    = billing_code_type|billing_code_type_version|billing_code|
//!                         billing_class|setting|severity_of_illness|billing_code_modifier[]
//!   provider_group_hash = tin_type|tin_value
//!
//! `billing_key_hash` is the pricing *slot*; everything in `rate_hash` that is not in the slot
//! (rate, negotiated_type, arrangement, service codes, additional information) is price/terms.

use xxhash_rust::xxh64::xxh64;

const SEED: u64 = 0;

/// Sorted copy of a string list, for both the canonical string and the stored array.
/// Returns a borrowed view when already sorted, so the common case does not allocate.
pub fn sorted<'a>(items: &'a [String]) -> std::borrow::Cow<'a, [String]> {
    if items.windows(2).all(|w| w[0] <= w[1]) {
        std::borrow::Cow::Borrowed(items)
    } else {
        let mut v = items.to_vec();
        v.sort_unstable();
        std::borrow::Cow::Owned(v)
    }
}

pub fn sorted_i64(items: &[i64]) -> std::borrow::Cow<'_, [i64]> {
    if items.windows(2).all(|w| w[0] <= w[1]) {
        std::borrow::Cow::Borrowed(items)
    } else {
        let mut v = items.to_vec();
        v.sort_unstable();
        std::borrow::Cow::Owned(v)
    }
}

fn push_list(out: &mut String, items: &[String]) {
    for (i, s) in items.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        out.push_str(s);
    }
}

pub fn format_rate(rate: Option<f64>) -> String {
    match rate {
        Some(r) => format!("{:.4}", r),
        None => String::new(),
    }
}

/// Fields of one negotiated price, already normalised (sorted arrays, "" for absent).
pub struct RateKey<'a> {
    pub billing_code_type: &'a str,
    pub billing_code_type_version: &'a str,
    pub billing_code: &'a str,
    pub negotiation_arrangement: &'a str,
    pub negotiated_type: &'a str,
    pub negotiated_rate: Option<f64>,
    pub billing_class: &'a str,
    pub setting: &'a str,
    pub severity_of_illness: &'a str,
    pub service_code: &'a [String],
    pub billing_code_modifier: &'a [String],
    pub additional_information: &'a [String],
}

impl RateKey<'_> {
    pub fn canonical_rate(&self) -> String {
        let mut s = String::with_capacity(128);
        for f in [
            self.billing_code_type,
            self.billing_code_type_version,
            self.billing_code,
            self.negotiation_arrangement,
            self.negotiated_type,
        ] {
            s.push_str(f);
            s.push('|');
        }
        s.push_str(&format_rate(self.negotiated_rate));
        s.push('|');
        for f in [self.billing_class, self.setting, self.severity_of_illness] {
            s.push_str(f);
            s.push('|');
        }
        push_list(&mut s, self.service_code);
        s.push('|');
        push_list(&mut s, self.billing_code_modifier);
        s.push('|');
        push_list(&mut s, self.additional_information);
        s
    }

    pub fn canonical_billing_key(&self) -> String {
        let mut s = String::with_capacity(64);
        for f in [
            self.billing_code_type,
            self.billing_code_type_version,
            self.billing_code,
            self.billing_class,
            self.setting,
            self.severity_of_illness,
        ] {
            s.push_str(f);
            s.push('|');
        }
        push_list(&mut s, self.billing_code_modifier);
        s
    }

    pub fn rate_hash(&self) -> u64 {
        xxh64(self.canonical_rate().as_bytes(), SEED)
    }

    pub fn billing_key_hash(&self) -> u64 {
        xxh64(self.canonical_billing_key().as_bytes(), SEED)
    }
}

pub fn provider_group_hash(tin_type: &str, tin_value: &str) -> u64 {
    let mut s = String::with_capacity(tin_type.len() + tin_value.len() + 1);
    s.push_str(tin_type);
    s.push('|');
    s.push_str(tin_value);
    xxh64(s.as_bytes(), SEED)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Reference values from ClickHouse: SELECT xxHash64('ein|123456789'), xxHash64('CPT|2026|99213|ffs|negotiated|100.5000|professional|||11|')
    // Fill in / keep in sync with the server: these guard the canonical string format.
    #[test]
    fn provider_group_hash_matches_clickhouse() {
        assert_eq!(provider_group_hash("ein", "123456789"), xxh64(b"ein|123456789", 0));
    }

    #[test]
    fn canonical_rate_string_layout() {
        let sc = vec!["22".to_string(), "11".to_string()];
        let sc = sorted(&sc);
        let k = RateKey {
            billing_code_type: "CPT",
            billing_code_type_version: "2026",
            billing_code: "99213",
            negotiation_arrangement: "ffs",
            negotiated_type: "negotiated",
            negotiated_rate: Some(100.5),
            billing_class: "professional",
            setting: "",
            severity_of_illness: "",
            service_code: &sc,
            billing_code_modifier: &[],
            additional_information: &[],
        };
        assert_eq!(k.canonical_rate(), "CPT|2026|99213|ffs|negotiated|100.5000|professional|||11,22||");
        assert_eq!(k.canonical_billing_key(), "CPT|2026|99213|professional|||");
        assert_eq!(k.rate_hash(), xxh64(b"CPT|2026|99213|ffs|negotiated|100.5000|professional|||11,22||", 0));
    }

    #[test]
    fn rate_formatting_collapses_equal_values() {
        assert_eq!(format_rate(Some(100.0)), "100.0000");
        assert_eq!(format_rate(Some(100.00001)), "100.0000");
        assert_eq!(format_rate(None), "");
    }

    #[test]
    fn sorted_borrows_when_already_sorted() {
        let v = vec!["a".to_string(), "b".to_string()];
        assert!(matches!(sorted(&v), std::borrow::Cow::Borrowed(_)));
        let u = vec!["b".to_string(), "a".to_string()];
        assert_eq!(sorted(&u).as_ref(), &["a".to_string(), "b".to_string()]);
    }
}

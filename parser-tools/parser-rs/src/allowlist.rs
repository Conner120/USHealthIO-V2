//! Zombie-rate classifier: decides whether a (billing_class, billing_code, billing_code_type,
//! billing_code_modifier[]) combination is structurally plausible.
//!
//! TiC MRF files are flooded with "zombie" rates — negotiated prices for pairings that can never
//! be billed (a facility-only modifier on a professional claim, a DRG under `professional`,
//! modifier 26 on a wheelchair, ...). This module encodes the structural rules that can be
//! checked from the price object alone. Clinical plausibility (provider taxonomy vs. code) needs
//! NPPES data and lives elsewhere.
//!
//! Rules are evaluated in order and the most severe verdict wins: DENY > REVIEW > ALLOW.
//! Each decision carries a stable `rule` id so downstream tooling can aggregate by rule.

use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Verdict {
    Allow,
    Review,
    Deny,
}

impl fmt::Display for Verdict {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str(match self {
            Verdict::Allow => "ALLOW",
            Verdict::Review => "REVIEW",
            Verdict::Deny => "DENY",
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Decision {
    pub verdict: Verdict,
    /// Stable identifier of the rule that produced the verdict (`ok` when nothing fired).
    pub rule: &'static str,
    pub reason: String,
}

impl Decision {
    fn allow() -> Self {
        Decision { verdict: Verdict::Allow, rule: "ok", reason: String::new() }
    }
    fn deny(rule: &'static str, reason: impl Into<String>) -> Self {
        Decision { verdict: Verdict::Deny, rule, reason: reason.into() }
    }
    fn review(rule: &'static str, reason: impl Into<String>) -> Self {
        Decision { verdict: Verdict::Review, rule, reason: reason.into() }
    }
    /// Keep whichever of `self` / `other` is more severe.
    fn worst(self, other: Decision) -> Decision {
        if other.verdict > self.verdict {
            other
        } else {
            self
        }
    }
}

// ---------------------------------------------------------------- code taxonomy

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Class {
    Professional,
    Institutional,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CodeType {
    Cpt,
    Hcpcs,
    MsDrg,
    Icd,
    Rc,
    Custom,
    Unknown,
}

/// CPT sections by numeric range, plus the alphanumeric categories.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CptSection {
    Anesthesia, // 00100–01999
    Surgery,    // 10004–69990
    Radiology,  // 70010–79999
    Pathology,  // 80047–89398
    Medicine,   // 90281–99199, 99500–99607
    Em,         // 99202–99499
    Cat2,       // ####F
    Cat3,       // ####T
    Pla,        // ####U
    Maaa,       // ####M
    Unknown,
}

fn parse_class(s: &str) -> Class {
    match s.trim().to_ascii_lowercase().as_str() {
        "professional" => Class::Professional,
        "institutional" => Class::Institutional,
        _ => Class::Unknown,
    }
}

fn parse_type(s: &str) -> CodeType {
    match s.trim().to_ascii_uppercase().as_str() {
        "CPT" => CodeType::Cpt,
        "HCPCS" => CodeType::Hcpcs,
        "MS-DRG" | "DRG" | "APR-DRG" | "R-DRG" | "AP-DRG" => CodeType::MsDrg,
        "ICD" | "ICD-10" | "ICD10" => CodeType::Icd,
        "RC" => CodeType::Rc,
        "CSTM-ALL" | "LOCAL" => CodeType::Custom,
        _ => CodeType::Unknown,
    }
}

fn cpt_section(code: &str) -> CptSection {
    let code = code.trim();
    if code.len() == 5 && code[..4].bytes().all(|b| b.is_ascii_digit()) {
        match code.as_bytes()[4].to_ascii_uppercase() {
            b'F' => return CptSection::Cat2,
            b'T' => return CptSection::Cat3,
            b'U' => return CptSection::Pla,
            b'M' => return CptSection::Maaa,
            _ => {}
        }
    }
    let Ok(n) = code.parse::<u32>() else { return CptSection::Unknown };
    match n {
        100..=1999 => CptSection::Anesthesia,
        10004..=69990 => CptSection::Surgery,
        70010..=79999 => CptSection::Radiology,
        80047..=89398 => CptSection::Pathology,
        90281..=99199 => CptSection::Medicine,
        99202..=99499 => CptSection::Em,
        99500..=99607 => CptSection::Medicine,
        _ => CptSection::Unknown,
    }
}

/// First letter of a HCPCS Level II code, upper-cased.
fn hcpcs_letter(code: &str) -> Option<char> {
    code.trim().chars().next().map(|c| c.to_ascii_uppercase()).filter(|c| c.is_ascii_alphabetic())
}

// ---------------------------------------------------------------- modifier groups

/// Professional/technical component split.
const PC_TC: &[&str] = &["26", "TC"];
/// Hospital outpatient E/M multi-encounter modifier — institutional (UB-04) only.
const FACILITY_ONLY: &[&str] = &["27"];
/// DMEPOS purchase/rental/capped-rental modifiers.
const DME: &[&str] = &[
    "NU", "RR", "UE", "KE", "KH", "KI", "KJ", "KC", "KF", "KL", "KM", "KN", "MS", "BP", "BR", "BU", "RA", "RB",
];
/// Telehealth modifiers.
const TELEHEALTH: &[&str] = &["GT", "GQ", "95", "G0", "GJ", "93", "FQ", "FR"];
/// CLIA-waived test.
const CLIA: &[&str] = &["QW"];
/// Generic modifiers that are valid on essentially any professional line: state Medicaid
/// (U*/H*/T*), surgical/anesthesia (22/25/50/51/52/53/58/78/79…), ABN/waiver, etc.
const GENERIC_OK: &[&str] = &[
    "22", "23", "24", "25", "32", "33", "47", "50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "62",
    "63", "66", "73", "74", "76", "77", "78", "79", "80", "81", "82", "AA", "AD", "QK", "QX", "QY", "QZ", "AJ",
    "AS", "AU", "AV", "AW", "CC", "CR", "ET", "GA", "GY", "GZ", "IH", "NH", "PA", "QF", "RS", "SC", "SE", "ST",
    "XE", "XP", "XS", "XU", "LT", "RT", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "FA", "T1", "T2",
    "T3", "T4", "T5", "T6", "T7", "T8", "T9", "TA", "E1", "E2", "E3", "E4", "KX", "JW", "JZ", "GC", "GE", "AQ",
    "AR", "CG", "PO", "PN", "AI", "AY",
];

fn in_group(m: &str, g: &[&str]) -> bool {
    g.iter().any(|x| x.eq_ignore_ascii_case(m))
}

fn is_state_or_program_modifier(m: &str) -> bool {
    // U1–UD state-defined; HA–HZ program-defined; TD–TU nursing/program; SA–SZ nurse practitioner etc.
    let b = m.as_bytes();
    b.len() == 2 && matches!(b[0].to_ascii_uppercase(), b'U' | b'H' | b'T' | b'S') && b[1].is_ascii_alphanumeric()
}

// ---------------------------------------------------------------- classifier

/// Classify one negotiated-price row. `negotiated_rate` is optional so the CSV-only path can
/// pass `None`; the pipeline passes the real value to catch `$0.00` placeholders.
pub fn classify(
    billing_class: &str,
    billing_code: &str,
    billing_code_type: &str,
    modifiers: &[String],
    negotiated_rate: Option<f64>,
) -> Decision {
    let class = parse_class(billing_class);
    let ty = parse_type(billing_code_type);
    let code = billing_code.trim();
    let mut d = Decision::allow();

    // ---- A. class × code-type
    d = d.worst(match (class, ty) {
        (Class::Unknown, _) => Decision::review("class.unknown", format!("unrecognised billing_class {billing_class:?}")),
        (_, CodeType::Unknown) => Decision::review("type.unknown", format!("unrecognised billing_code_type {billing_code_type:?}")),
        (_, CodeType::Custom) => Decision::review("type.custom", "plan-specific custom code, not comparable across payers"),
        (Class::Professional, CodeType::MsDrg) => Decision::deny("class.prof_drg", "DRG is an inpatient facility payment unit; never billed professionally"),
        (Class::Professional, CodeType::Icd) => Decision::deny("class.prof_icd", "ICD-10-PCS procedure codes are billed on UB-04 (institutional) only"),
        (Class::Professional, CodeType::Rc) => Decision::deny("class.prof_rc", "revenue codes exist only on institutional (UB-04) claims"),
        _ => Decision::allow(),
    });

    // ---- B. class × code-range
    match (class, ty) {
        (Class::Professional, CodeType::Hcpcs) => {
            if hcpcs_letter(code) == Some('C') {
                d = d.worst(Decision::deny("range.prof_c_code", "C-codes are OPPS hospital-outpatient (institutional) only"));
            }
        }
        (Class::Institutional, CodeType::Cpt) => match cpt_section(code) {
            CptSection::Anesthesia => {
                d = d.worst(Decision::deny("range.inst_anesthesia", "anesthesia CPT is professional-only; facilities bill OR/anesthesia revenue codes"));
            }
            CptSection::Em => {
                let n: u32 = code.parse().unwrap_or(0);
                let facility_em = matches!(n, 99281..=99285 | 99291..=99292);
                if !facility_em {
                    d = d.worst(Decision::review("range.inst_em", "office/home/NF E/M under institutional class; HOPD clinic visits normally use G0463"));
                }
            }
            _ => {}
        },
        (Class::Institutional, CodeType::Hcpcs) => {
            if matches!(hcpcs_letter(code), Some('E' | 'K' | 'L')) {
                d = d.worst(Decision::deny("range.inst_dme", "DMEPOS (E/K/L) codes are billed by suppliers on professional claims"));
            }
        }
        _ => {}
    }

    // ---- C. modifiers
    for raw in modifiers {
        let m = raw.trim();
        if m.is_empty() {
            continue;
        }
        let mu = m.to_ascii_uppercase();

        if class == Class::Institutional {
            d = d.worst(Decision::review("mod.inst_modifier", format!("modifier {mu} on an institutional line")));
            continue;
        }

        if in_group(&mu, FACILITY_ONLY) {
            d = d.worst(Decision::deny("mod.27_professional", "modifier 27 (multiple outpatient hospital E/M) is UB-04 only"));
        } else if in_group(&mu, PC_TC) {
            let ok = match ty {
                CodeType::Cpt => matches!(
                    cpt_section(code),
                    CptSection::Radiology | CptSection::Pathology | CptSection::Medicine | CptSection::Cat3 | CptSection::Pla
                ),
                CodeType::Hcpcs => matches!(hcpcs_letter(code), Some('G' | 'P' | 'Q' | 'M' | 'R')),
                _ => false,
            };
            if !ok {
                d = d.worst(Decision::deny("mod.pctc_no_split", format!("modifier {mu} on a code with no professional/technical component split")));
            }
        } else if in_group(&mu, DME) {
            let ok = ty == CodeType::Hcpcs
                && matches!(hcpcs_letter(code), Some('A' | 'B' | 'E' | 'K' | 'L' | 'V' | 'T' | 'S' | 'Q' | 'P' | 'G'));
            if !ok {
                d = d.worst(Decision::deny("mod.dme_non_dme", format!("DMEPOS modifier {mu} on a non-DMEPOS code")));
            }
        } else if in_group(&mu, TELEHEALTH) {
            let ok = match ty {
                CodeType::Cpt => matches!(cpt_section(code), CptSection::Em | CptSection::Medicine | CptSection::Cat3 | CptSection::Cat2),
                CodeType::Hcpcs => matches!(hcpcs_letter(code), Some('G' | 'H' | 'T' | 'Q' | 'S')),
                _ => false,
            };
            if !ok {
                d = d.worst(Decision::deny("mod.telehealth_non_visit", format!("telehealth modifier {mu} on a procedure/imaging/DME code")));
            }
        } else if in_group(&mu, CLIA) {
            let ok = match ty {
                CodeType::Cpt => matches!(cpt_section(code), CptSection::Pathology | CptSection::Pla),
                CodeType::Hcpcs => matches!(hcpcs_letter(code), Some('G' | 'U' | 'P')),
                _ => false,
            };
            if !ok {
                d = d.worst(Decision::deny("mod.qw_non_lab", "QW (CLIA-waived) on a non-laboratory code"));
            }
        } else if in_group(&mu, GENERIC_OK) || is_state_or_program_modifier(&mu) {
            // fine
        } else {
            d = d.worst(Decision::review("mod.unknown", format!("unrecognised modifier {mu}")));
        }
    }

    // ---- D. price placeholders
    if let Some(r) = negotiated_rate {
        if !(r > 0.01) {
            d = d.worst(Decision::deny("rate.placeholder", format!("negotiated_rate {r} is a placeholder")));
        }
    }

    d
}

#[cfg(test)]
mod tests {
    use super::*;

    fn c(class: &str, code: &str, ty: &str, mods: &[&str]) -> Decision {
        let m: Vec<String> = mods.iter().map(|s| s.to_string()).collect();
        classify(class, code, ty, &m, None)
    }

    #[test]
    fn plain_rows_allow() {
        assert_eq!(c("professional", "99213", "CPT", &[]).verdict, Verdict::Allow);
        assert_eq!(c("institutional", "49905", "CPT", &[]).verdict, Verdict::Allow);
        assert_eq!(c("institutional", "0110", "RC", &[]).verdict, Verdict::Allow);
        assert_eq!(c("institutional", "0001", "MS-DRG", &[]).verdict, Verdict::Allow);
        assert_eq!(c("professional", "E0601", "HCPCS", &["NU", "KE"]).verdict, Verdict::Allow);
        assert_eq!(c("professional", "71046", "CPT", &["26"]).verdict, Verdict::Allow);
        assert_eq!(c("professional", "99213", "CPT", &["GT"]).verdict, Verdict::Allow);
        assert_eq!(c("professional", "87804", "CPT", &["QW"]).verdict, Verdict::Allow);
        assert_eq!(c("professional", "43331", "CPT", &["U1"]).verdict, Verdict::Allow);
    }

    #[test]
    fn class_type_mismatch_denies() {
        assert_eq!(c("professional", "0001", "MS-DRG", &[]).rule, "class.prof_drg");
        assert_eq!(c("professional", "0110", "RC", &[]).rule, "class.prof_rc");
        assert_eq!(c("professional", "C7555", "HCPCS", &[]).rule, "range.prof_c_code");
        assert_eq!(c("institutional", "00100", "CPT", &[]).rule, "range.inst_anesthesia");
        assert_eq!(c("institutional", "E0601", "HCPCS", &[]).rule, "range.inst_dme");
        assert_eq!(c("institutional", "99213", "CPT", &[]).verdict, Verdict::Review);
        assert_eq!(c("institutional", "99285", "CPT", &[]).verdict, Verdict::Allow);
    }

    #[test]
    fn modifier_zombies() {
        assert_eq!(c("professional", "80053", "CPT", &["27"]).rule, "mod.27_professional");
        assert_eq!(c("professional", "E0601", "HCPCS", &["26"]).rule, "mod.pctc_no_split");
        assert_eq!(c("professional", "99213", "CPT", &["TC"]).rule, "mod.pctc_no_split");
        assert_eq!(c("professional", "27447", "CPT", &["NU"]).rule, "mod.dme_non_dme");
        assert_eq!(c("professional", "27447", "CPT", &["GT"]).rule, "mod.telehealth_non_visit");
        assert_eq!(c("professional", "99213", "CPT", &["QW"]).rule, "mod.qw_non_lab");
        assert_eq!(c("professional", "99213", "CPT", &["ZZ"]).verdict, Verdict::Review);
        assert_eq!(c("institutional", "49905", "CPT", &["26"]).verdict, Verdict::Review);
    }

    #[test]
    fn severity_ordering_and_rate() {
        // review + deny → deny
        assert_eq!(c("professional", "PRO", "CSTM-ALL", &["27"]).verdict, Verdict::Deny);
        let m: Vec<String> = vec![];
        assert_eq!(classify("professional", "99213", "CPT", &m, Some(0.0)).rule, "rate.placeholder");
        assert_eq!(classify("professional", "99213", "CPT", &m, Some(85.5)).verdict, Verdict::Allow);
    }
}

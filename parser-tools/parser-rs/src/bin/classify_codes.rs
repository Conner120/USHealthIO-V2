//! Standalone runner for the zombie-rate classifier over a billing-codes CSV.
//!
//!   cargo run --release --bin classify_codes -- data/billing_codes.csv [out.csv]
//!
//! Input columns (header, any order, whitespace-tolerant):
//!   billing_class, billing_code, billing_code_type, billing_code_modifier   (python-list style "['26','TC']")
//!   negotiated_rate (optional)
//! Output: the input columns + verdict, rule, reason; a per-rule summary goes to stderr.

#[path = "../allowlist.rs"]
mod allowlist;

use allowlist::{classify, Verdict};
use std::collections::BTreeMap;
use std::fs::File;
use std::io::{self, BufRead, BufReader, BufWriter, Write};

/// Minimal RFC-4180 field splitter (quoted fields, doubled quotes). Enough for this file shape.
fn split_csv(line: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut in_q = false;
    let mut chars = line.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '"' if in_q && chars.peek() == Some(&'"') => {
                cur.push('"');
                chars.next();
            }
            '"' => in_q = !in_q,
            ',' if !in_q => out.push(std::mem::take(&mut cur)),
            _ => cur.push(c),
        }
    }
    out.push(cur);
    out
}

fn quote(s: &str) -> String {
    if s.contains([',', '"', '\n']) {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

/// `"['NU','KE']"` / `"[]"` / `"NU|KE"` / `"NU"` → `["NU","KE"]`.
fn parse_modifiers(s: &str) -> Vec<String> {
    s.trim()
        .trim_start_matches('[')
        .trim_end_matches(']')
        .split(|c| c == ',' || c == '|')
        .map(|m| m.trim().trim_matches(|c| c == '\'' || c == '"').trim().to_string())
        .filter(|m| !m.is_empty())
        .collect()
}

fn main() -> io::Result<()> {
    let mut args = std::env::args().skip(1);
    let input = args.next().unwrap_or_else(|| {
        eprintln!("usage: classify_codes <billing_codes.csv> [out.csv]");
        std::process::exit(2);
    });
    let output = args.next().unwrap_or_else(|| {
        let stem = input.strip_suffix(".csv").unwrap_or(&input);
        format!("{stem}_classified.csv")
    });

    let reader = BufReader::new(File::open(&input)?);
    let mut lines = reader.lines();
    let header_line = lines.next().transpose()?.unwrap_or_default();
    let header: Vec<String> = split_csv(&header_line).iter().map(|h| h.trim().to_string()).collect();
    let col = |name: &str| header.iter().position(|h| h.eq_ignore_ascii_case(name));
    let (Some(i_class), Some(i_code), Some(i_type)) =
        (col("billing_class"), col("billing_code"), col("billing_code_type"))
    else {
        eprintln!("missing required columns; found {:?}", header);
        std::process::exit(2);
    };
    let i_mod = col("billing_code_modifier");
    let i_rate = col("negotiated_rate");

    let mut w = BufWriter::new(File::create(&output)?);
    let mut out_header: Vec<String> = header.iter().map(|h| quote(h)).collect();
    out_header.extend(["verdict", "rule", "reason"].map(String::from));
    writeln!(w, "{}", out_header.join(","))?;

    let mut by_verdict: BTreeMap<String, u64> = BTreeMap::new();
    let mut by_rule: BTreeMap<(String, &'static str), u64> = BTreeMap::new();
    let mut by_class_verdict: BTreeMap<(String, String), u64> = BTreeMap::new();
    let mut total = 0u64;

    for line in lines {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let f = split_csv(&line);
        let get = |i: usize| f.get(i).map(|s| s.trim()).unwrap_or("");
        let mods = i_mod.map(|i| parse_modifiers(get(i))).unwrap_or_default();
        let rate = i_rate.and_then(|i| get(i).parse::<f64>().ok());
        let d = classify(get(i_class), get(i_code), get(i_type), &mods, rate);

        let v = d.verdict.to_string();
        *by_verdict.entry(v.clone()).or_default() += 1;
        *by_rule.entry((v.clone(), d.rule)).or_default() += 1;
        *by_class_verdict.entry((get(i_class).to_ascii_lowercase(), v.clone())).or_default() += 1;
        total += 1;

        let mut row: Vec<String> = f.iter().map(|s| quote(s)).collect();
        row.push(v);
        row.push(d.rule.to_string());
        row.push(quote(&d.reason));
        writeln!(w, "{}", row.join(","))?;
    }
    w.flush()?;

    eprintln!("classified {total} rows → {output}\n");
    eprintln!("verdict summary:");
    for v in [Verdict::Allow, Verdict::Review, Verdict::Deny] {
        let n = by_verdict.get(&v.to_string()).copied().unwrap_or(0);
        eprintln!("  {:<7} {:>8}  ({:>5.1}%)", v, n, n as f64 * 100.0 / total.max(1) as f64);
    }
    eprintln!("\nby class:");
    for ((c, v), n) in &by_class_verdict {
        eprintln!("  {:<14} {:<7} {:>8}", c, v, n);
    }
    eprintln!("\nby rule:");
    let mut rules: Vec<_> = by_rule.iter().collect();
    rules.sort_by(|a, b| b.1.cmp(a.1));
    for ((v, r), n) in rules {
        eprintln!("  {:<7} {:<28} {:>8}", v, r, n);
    }
    Ok(())
}

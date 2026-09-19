//! Structural scanner for an MRF file: finds the byte range of every element of the top-level
//! `provider_references` and `in_network` arrays without decoding any values, so the expensive
//! parsing can be fanned out to worker threads. Also captures the top-level string members
//! (reporting_entity_name, plan_name, ...) as the file header.
//!
//! It is a depth/string-aware byte walker: inside strings it jumps with `memchr2` for `"`/`\`,
//! outside strings it steps over structural bytes only. On a modern core it runs at >1 GB/s, so
//! the scanner is never the bottleneck even against many parser workers.

use crate::model::FileHeader;
use memchr::{memchr2, memchr3};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Section {
    ProviderReferences,
    InNetwork,
}

#[derive(Debug, Clone, Copy)]
pub struct Element {
    pub section: Section,
    pub start: usize,
    pub end: usize,
}

#[derive(Debug)]
pub struct ScanError {
    pub message: String,
}

fn err(msg: impl Into<String>) -> ScanError {
    ScanError { message: msg.into() }
}

#[derive(Debug, Default, Clone, Copy)]
pub struct ScanStats {
    pub provider_reference_elements: u64,
    pub in_network_elements: u64,
}

/// Walks `buf` and calls `emit` for each element of the arrays selected by `sections`. Elements are
/// emitted in file order. Returns the parsed file header and element counts.
///
/// `emit` returning `Err` aborts the scan (e.g. because every consumer has gone away).
pub fn scan<F>(
    buf: &[u8],
    sections: &[Section],
    mut emit: F,
) -> Result<(FileHeader, ScanStats), ScanError>
where
    F: FnMut(Element) -> Result<(), ScanError>,
{
    let mut header = FileHeader::default();
    let mut stats = ScanStats::default();
    let mut pos = skip_ws(buf, 0);
    if buf.get(pos) != Some(&b'{') {
        return Err(err("expected top-level object"));
    }
    pos += 1;
    loop {
        pos = skip_ws(buf, pos);
        match buf.get(pos) {
            Some(b'}') => break,
            Some(b',') => {
                pos += 1;
                continue;
            }
            Some(b'"') => {}
            Some(b) => return Err(err(format!("unexpected byte {:?} at {}", *b as char, pos))),
            None => return Err(err("unexpected EOF in top-level object")),
        }
        let key_end = string_end(buf, pos)?;
        let key = &buf[pos + 1..key_end - 1];
        pos = skip_ws(buf, key_end);
        if buf.get(pos) != Some(&b':') {
            return Err(err(format!("expected ':' at {}", pos)));
        }
        pos = skip_ws(buf, pos + 1);

        let section = match key {
            b"provider_references" => Some(Section::ProviderReferences),
            b"in_network" => Some(Section::InNetwork),
            _ => None,
        };

        match (section, buf.get(pos)) {
            (Some(section), Some(b'[')) if sections.contains(&section) => {
                pos += 1;
                loop {
                    pos = skip_ws(buf, pos);
                    match buf.get(pos) {
                        Some(b']') => {
                            pos += 1;
                            break;
                        }
                        Some(b',') => {
                            pos += 1;
                            continue;
                        }
                        Some(_) => {}
                        None => return Err(err("unexpected EOF in array")),
                    }
                    let end = skip_value(buf, pos)?;
                    match section {
                        Section::ProviderReferences => stats.provider_reference_elements += 1,
                        Section::InNetwork => stats.in_network_elements += 1,
                    }
                    emit(Element { section, start: pos, end })?;
                    pos = end;
                }
            }
            (_, Some(b'"')) => {
                let end = string_end(buf, pos)?;
                if let Ok(key) = std::str::from_utf8(key) {
                    if let Ok(value) = serde_json::from_slice::<String>(&buf[pos..end]) {
                        header.set(key, value);
                    }
                }
                pos = end;
            }
            (_, Some(_)) => {
                pos = skip_value(buf, pos)?;
            }
            (_, None) => return Err(err("unexpected EOF after key")),
        }
    }
    Ok((header, stats))
}

#[inline]
fn skip_ws(buf: &[u8], mut pos: usize) -> usize {
    while let Some(b) = buf.get(pos) {
        if matches!(b, b' ' | b'\n' | b'\r' | b'\t') {
            pos += 1;
        } else {
            break;
        }
    }
    pos
}

/// `pos` points at the opening quote; returns the index just past the closing quote.
#[inline]
fn string_end(buf: &[u8], pos: usize) -> Result<usize, ScanError> {
    let mut i = pos + 1;
    loop {
        match memchr2(b'"', b'\\', &buf[i..]) {
            Some(off) => {
                let j = i + off;
                if buf[j] == b'"' {
                    return Ok(j + 1);
                }
                i = j + 2; // skip escaped char
            }
            None => return Err(err(format!("unterminated string starting at {}", pos))),
        }
    }
}

/// Returns the index just past the value starting at `pos` (object, array, string or scalar).
fn skip_value(buf: &[u8], pos: usize) -> Result<usize, ScanError> {
    match buf.get(pos) {
        Some(b'"') => string_end(buf, pos),
        Some(b'{') => skip_container(buf, pos, b'{', b'}'),
        Some(b'[') => skip_container(buf, pos, b'[', b']'),
        Some(_) => {
            let mut i = pos;
            while let Some(&b) = buf.get(i) {
                if matches!(b, b',' | b'}' | b']' | b' ' | b'\n' | b'\r' | b'\t') {
                    break;
                }
                i += 1;
            }
            Ok(i)
        }
        None => Err(err("unexpected EOF")),
    }
}

/// Finds the end of a container by balancing only its own bracket kind. In well-formed JSON the
/// other kind can never unbalance it, so a SIMD `memchr3` over (`"`, open, close) is enough and
/// runs several times faster than a byte-at-a-time loop.
#[inline]
fn skip_container(buf: &[u8], pos: usize, open: u8, close: u8) -> Result<usize, ScanError> {
    let mut depth: usize = 0;
    let mut i = pos;
    while let Some(off) = memchr3(b'"', open, close, &buf[i..]) {
        let j = i + off;
        match buf[j] {
            b'"' => i = string_end(buf, j)?,
            b if b == open => {
                depth += 1;
                i = j + 1;
            }
            _ => {
                depth -= 1;
                i = j + 1;
                if depth == 0 {
                    return Ok(i);
                }
            }
        }
    }
    Err(err(format!("unterminated container starting at {}", pos)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_elements_and_header() {
        let src = br#"{"reporting_entity_name":"X \"quoted\"","version":"1.0","provider_references":[{"provider_group_id":1,"provider_groups":[{"npi":[1],"tin":{"type":"ein","value":"a}"}}]},{"provider_group_id":2}],"last_updated_on":"2026-01-01","in_network":[{"billing_code":"1","negotiated_rates":[]}],"x":[1,2,{"y":[]}]}"#;
        let mut got = vec![];
        let (h, s) = scan(src, &[Section::ProviderReferences, Section::InNetwork], |e| {
            got.push((e.section, String::from_utf8_lossy(&src[e.start..e.end]).to_string()));
            Ok(())
        })
        .unwrap();
        assert_eq!(h.reporting_entity_name, "X \"quoted\"");
        assert_eq!(h.version, "1.0");
        assert_eq!(s.provider_reference_elements, 2);
        assert_eq!(s.in_network_elements, 1);
        assert_eq!(got.len(), 3);
        assert!(got[0].1.starts_with(r#"{"provider_group_id":1"#));
        assert!(got[0].1.ends_with("}]}"));
        assert_eq!(got[1].1, r#"{"provider_group_id":2}"#);
        assert_eq!(got[2].0, Section::InNetwork);
    }
}

use std::sync::OnceLock;

fn is_debug() -> bool {
    static DEBUG: OnceLock<bool> = OnceLock::new();
    *DEBUG.get_or_init(|| std::env::var("PARSER_DEBUG").is_ok())
}

pub fn debug_begin_object(path: &str) {
    if is_debug() {
        eprintln!("[DEBUG] begin_object @ {}", path);
    }
}

pub fn debug_end_object(path: &str) {
    if is_debug() {
        eprintln!("[DEBUG] end_object @ {}", path);
    }
}

pub fn debug_begin_array(path: &str) {
    if is_debug() {
        eprintln!("[DEBUG] begin_array @ {}", path);
    }
}

pub fn debug_end_array(path: &str) {
    if is_debug() {
        eprintln!("[DEBUG] end_array @ {}", path);
    }
}

mod allowlist;
mod config;
mod fetch;
mod kafka;
mod model;
mod pipeline;
mod scan;
mod sink;

use crate::config::Config;
use dotenv::dotenv;
use std::env;

fn main() {
    dotenv().ok();
    let config = Config::from_env();

    let path = env::args().nth(1).expect("usage: main <file.json> in_network_rates <job_id>");
    let mode = env::args().nth(2).unwrap_or_default();
    let job_id = env::args().nth(3).unwrap_or_else(|| "unknown".to_string());
    if mode != "in_network_rates" {
        eprintln!("unsupported mode {:?} (expected in_network_rates)", mode);
        std::process::exit(2);
    }
    if job_id == "unknown" {
        eprintln!("Job ID not provided");
        std::process::exit(2);
    }

    // Worker tasks do CPU-heavy parsing inline, so size the runtime to the worker count.
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(config.threads)
        .enable_all()
        .build()
        .expect("failed to build tokio runtime");

    let result = runtime.block_on(pipeline::run(&config, &path, &job_id));
    if let Err(e) = result {
        eprintln!("in_network_rates failed: {}", e.message);
        std::process::exit(1);
    }
}

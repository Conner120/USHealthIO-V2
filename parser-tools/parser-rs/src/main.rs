mod in_network;
mod kafka;
use crate::in_network::file_root::in_network_file_root;
use rdkafka::producer::{DefaultProducerContext, FutureProducer, Producer, ThreadedProducer};
use rdkafka::ClientConfig;
use std::{env, fs};
use struson::reader::JsonStreamReader;

pub fn create_producer() -> ThreadedProducer<DefaultProducerContext> {
    let producer: ThreadedProducer<DefaultProducerContext> = ClientConfig::new()
        .set("bootstrap.servers", "192.168.20.60:31959")
        .set("batch.size", "16380400")
        .set("linger.ms", "10")
        .set("message.max.bytes", "5242880")
        .set("queue.buffering.max.messages", "1000000")
        .create()
        .expect("Producer creation error");

    // check connection

    println!("ThreadedProducer created.");
    producer
}
#[tokio::main]
async fn main() {
    // create kafka producer with arc
    let producer = create_producer();
    // get file path as argument
    let path = env::args().nth(1).expect("No file path provided.");
    // let path = "test.json";
    // let file_bytes = fs::read("test.json").expect("file not found");
    // file reader without loading entire file into memory
    let reader = fs::File::open(path).expect("file not found");
    // counter to measure processed in_network objects
    let mut stream = JsonStreamReader::new(reader);

    // The first argument is the path to the executable
    let first_arg = parse_args();
    // let first_arg = Args::InNetworkRates;
    match first_arg {
        Args::InNetworkRates => {
            let job_id = env::args().nth(3).unwrap_or_else(|| "unknown".to_string());
            if job_id == "unknown" {
                println!("Job ID not provided, using default value: {}", job_id);
                return;
            }
            in_network_file_root(&mut stream, &producer, &job_id)
                .await
                .expect("TODO: panic message");
        }
        _ => {
            return;
        }
    }
}

fn parse_args() -> Args {
    match env::args().nth(2).unwrap().as_str() {
        "in_network_rates" => Args::InNetworkRates,
        "in_network_providers" => Args::InNetworkProviders,
        _ => panic!("Invalid argument: {}", env::args().nth(2).unwrap()),
    }
}

#[derive(Debug)]
enum Args {
    InNetworkRates,
    InNetworkProviders,
}

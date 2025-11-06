mod in_network;
mod kafka;
use std::fs;
use struson::reader::{JsonStreamReader};
use crate::in_network::file_root::in_network_file_root;
use rdkafka::ClientConfig;
use rdkafka::producer::{DefaultProducerContext, FutureProducer, Producer, ThreadedProducer};

pub fn create_producer() -> ThreadedProducer<DefaultProducerContext> {
    let producer: ThreadedProducer<DefaultProducerContext> = ClientConfig::new()
        .set("bootstrap.servers", "192.168.20.60:30737")
        .set("batch.size", "16380400")
        .set("linger.ms", "10")
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
    let path = std::env::args().nth(1).expect("No file path provided");
    // let file_bytes = fs::read("test.json").expect("file not found");
    // file reader without loading entire file into memory
    let reader = fs::File::open(path).expect("file not found");
    // counter to measure processed in_network objects
    let mut stream = JsonStreamReader::new(reader);
    in_network_file_root(&mut stream,&producer).await.expect("TODO: panic message");
}

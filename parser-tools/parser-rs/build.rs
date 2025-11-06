// build.rs
fn main() {
    // build proto buf
    protobuf_codegen_pure::Codegen::new()
        .out_dir("./src") // Output directory for generated Rust code
        .inputs(&["src/protos/kafka.proto"]) // Path to your .proto file
        .include("src/protos") // Include directory for resolving imports in .proto files
        .run()
        .expect("Protobuf codegen failed.");
}
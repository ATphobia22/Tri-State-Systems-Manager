//! Ingest and verify canonical reasoning graphs with offline provenance.
//! No online services and no model-dependent scientific authority.
use sovereign_dedup_engine::evidence::{ingest_graph, verify_record, EvidenceRecord};
use sovereign_dedup_engine::graph::ReasoningGraph;
use sovereign_dedup_engine::ChunkConfig;
use std::{fs, io, path::Path};

fn limited_read(path: &Path, max: u64) -> io::Result<Vec<u8>> {
    let info = fs::symlink_metadata(path)?;
    if !info.file_type().is_file() || info.len() > max {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "input not regular file or exceeds limit"));
    }
    let bytes = fs::read(path)?;
    if bytes.len() as u64 > max {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "input exceeds limit"));
    }
    Ok(bytes)
}
fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 6 && args.len() != 4 {
        return Err("usage: sde-graph ingest <store-dir> <reasoning-graph.json> <provenance.json> <record-output.json> | sde-graph verify <store-dir> <record.json>".into());
    }
    match (args[1].as_str(), args.len()) {
        ("ingest", 6) => {
            let root = Path::new(&args[2]);
            let graph: ReasoningGraph =
                serde_json::from_slice(&limited_read(Path::new(&args[3]), 32 * 1024 * 1024)?)?;
            let provenance = limited_read(Path::new(&args[4]), 1024 * 1024)?;
            let parsed: serde_json::Value = serde_json::from_slice(&provenance)?;
            if !parsed.is_object() {
                return Err("provenance must be a JSON object".into());
            }
            let output = Path::new(&args[5]);
            if output.exists() { return Err("refusing to overwrite existing record output".into()); }
            let record = ingest_graph(root, &graph, &provenance, ChunkConfig::default())?;
            let canonical = serde_json::to_vec_pretty(&record)?;
            let verified = verify_record(root, &record)?;
            if !verified { return Err("post-ingest integrity verification failed".into()); }
            if let Some(parent) = output.parent() { fs::create_dir_all(parent)?; }
            fs::write(output, canonical)?;
            println!("SDE_GRAPH_SHA256={}", record.graph_sha256);
            println!("SDE_REVIEW_STATE={}", record.review_state);
        }
        ("verify", 4) => {
            let root = Path::new(&args[2]);
            let record: EvidenceRecord =
                serde_json::from_slice(&limited_read(Path::new(&args[3]), 4 * 1024 * 1024)?)?;
            if !verify_record(root, &record)? {
                return Err("evidence record failed integrity verification".into());
            }
            println!("SDE_RECORD_INTEGRITY=VERIFIED; SCIENTIFIC_REVIEW=NOT_EVIDENCED");
        }
        _ => return Err("invalid command or argument count".into()),
    }
    Ok(())
}
fn main() {
    if let Err(err) = run() {
        eprintln!("sde-graph: {err}");
        std::process::exit(1);
    }
}

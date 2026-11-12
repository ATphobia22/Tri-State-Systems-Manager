//! Corpus-level SDE benchmark. Run with actual canonical evidence graphs.
//! Does not ship or fabricate a representative production corpus.
use sovereign_dedup_engine::{metrics, store, ChunkConfig};
use std::{fs, path::PathBuf, time::Instant};

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 4 {
        return Err("usage: cargo run --release --bin sde-benchmark -- <store-dir> <report.json> <input1> [input2 ...]".into());
    }
    let root = PathBuf::from(&args[1]);
    let report_path = PathBuf::from(&args[2]);
    if report_path.exists() { return Err("refusing to overwrite existing report".into()); }
    let start = Instant::now();
    let mut manifests = Vec::new();
    for name in &args[3..] {
        let bytes = fs::read(name)?;
        manifests.push(store(&root, &bytes, ChunkConfig::default())?);
    }
    let summary = metrics(&manifests);
    let physical_object_bytes: u64 = fs::read_dir(root.join("objects"))?
        .map(|entry| -> std::io::Result<u64> {
            let mut total = 0;
            for file in fs::read_dir(entry?.path())? { total += file?.metadata()?.len(); }
            Ok(total)
        }).collect::<Result<Vec<_>, _>>()?.into_iter().sum();
    let report = serde_json::json!({
        "schema":"tsm.sde.benchmark.v1",
        "corpus_files": manifests.len(),
        "metrics": summary,
        "physical_object_bytes": physical_object_bytes,
        "elapsed_ms": start.elapsed().as_millis(),
        "caveat":"Object bytes exclude filesystem overhead, manifests, encryption, and ledger records; no inference about general savings."
    });
    if let Some(parent) = report_path.parent() { fs::create_dir_all(parent)?; }
    fs::write(&report_path, serde_json::to_vec_pretty(&report)?)?;
    println!("{}", serde_json::to_string_pretty(&report)?);
    Ok(())
}
fn main() {
    if let Err(err) = run() { eprintln!("sde-benchmark: {err}"); std::process::exit(1); }
}

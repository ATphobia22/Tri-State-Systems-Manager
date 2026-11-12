use sovereign_dedup_engine::{metrics, restore, store, ChunkConfig, Manifest};
use std::fs;
use std::path::PathBuf;

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 5 {
        return Err("usage: sde <store|restore> <object-store-dir> <input-file> <output-file>".into());
    }
    let root = PathBuf::from(&args[2]);
    let input = PathBuf::from(&args[3]);
    let output = PathBuf::from(&args[4]);
    if output.exists() { return Err("refusing to overwrite existing output".into()); }
    if let Some(parent) = output.parent() { fs::create_dir_all(parent)?; }
    match args[1].as_str() {
        "store" => {
            let bytes = fs::read(input)?;
            let manifest = store(&root, &bytes, ChunkConfig::default())?;
            let report = metrics(&[manifest.clone()]);
            fs::write(output, serde_json::to_vec_pretty(&manifest)?)?;
            eprintln!("{}", serde_json::to_string_pretty(&report)?);
        }
        "restore" => {
            let manifest: Manifest = serde_json::from_slice(&fs::read(input)?)?;
            let bytes = restore(&root, &manifest)?;
            fs::write(output, bytes)?;
        }
        _ => return Err("command must be store or restore".into()),
    }
    Ok(())
}
fn main() {
    if let Err(err) = run() {
        eprintln!("sde: {err}");
        std::process::exit(1);
    }
}

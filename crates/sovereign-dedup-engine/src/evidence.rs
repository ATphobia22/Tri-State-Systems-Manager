//! Local content-addressed SDE adapter for TSM's evidence plane.
//!
//! Hashes establish byte integrity, not provenance trust, correctness or
//! regulatory authority. The record starts UNVERIFIED and has no auto-approval.
use crate::{
    graph::{canonical_graph, ReasoningGraph},
    restore, store, ChunkConfig, Manifest,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs, io,
    path::Path,
    sync::atomic::{AtomicU64, Ordering},
};
static NEXT_LEDGER_TEMP: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EvidenceRecord {
    pub schema: String,
    pub graph_sha256: String,
    pub provenance_sha256: String,
    pub graph_manifest: Manifest,
    pub provenance_manifest: Manifest,
    pub review_state: String,
}

fn digest(data: &[u8]) -> String {
    format!("{:x}", Sha256::digest(data))
}
fn ledger_path(root: &Path, record: &EvidenceRecord) -> std::path::PathBuf {
    root.join("ledger").join(format!(
        "{}-{}.json", record.graph_sha256, record.provenance_sha256
    ))
}

/// Store graph and actual provenance bytes; publish the evidence record only
/// after the objects are complete. Idempotent across concurrent processes.
pub fn ingest_graph(
    root: &Path,
    graph: &ReasoningGraph,
    provenance: &[u8],
    config: ChunkConfig,
) -> io::Result<EvidenceRecord> {
    if provenance.is_empty() || provenance.len() > 1024 * 1024 {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "provenance required (maximum 1 MiB)"));
    }
    let provenance_json: serde_json::Value =
        serde_json::from_slice(provenance).map_err(io::Error::other)?;
    if !provenance_json.is_object() {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "provenance must be a JSON object"));
    }
    let bytes = canonical_graph(graph)?;
    let graph_manifest = store(root, &bytes, config)?;
    let provenance_manifest = store(root, provenance, config)?;
    let record = EvidenceRecord {
        schema: "tsm.sde.evidence-record.v2".into(),
        graph_sha256: digest(&bytes),
        provenance_sha256: digest(provenance),
        graph_manifest,
        provenance_manifest,
        review_state: "UNVERIFIED".into(),
    };
    let target = ledger_path(root, &record);
    fs::create_dir_all(target.parent().unwrap())?;
    let serialized = serde_json::to_vec_pretty(&record).map_err(io::Error::other)?;

    // Complete fsynced temporary file -> atomic hard-link publish.
    // No update or silent overwrite of an existing ledger identity.
    let sequence = NEXT_LEDGER_TEMP.fetch_add(1, Ordering::Relaxed);
    let temp = target.with_extension(format!("tmp-{}-{sequence}", std::process::id()));
    let publish = (|| -> io::Result<()> {
        use std::io::Write;
        let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&temp)?;
        file.write_all(&serialized)?;
        file.sync_all()?;
        drop(file);
        match fs::hard_link(&temp, &target) {
            Ok(()) => Ok(()),
            Err(err) if err.kind() == io::ErrorKind::AlreadyExists => Ok(()),
            Err(err) => Err(err),
        }
    })();
    let _ = fs::remove_file(&temp);
    publish?;
    if fs::read(&target)? != serialized {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "conflicting ledger record"));
    }
    Ok(record)
}

/// Verify that the record is actually in the local ledger and every graph and
/// provenance chunk can be restored byte-for-byte with its claimed digest.
pub fn verify_record(root: &Path, record: &EvidenceRecord) -> io::Result<bool> {
    if record.schema != "tsm.sde.evidence-record.v2" || record.review_state != "UNVERIFIED" {
        return Ok(false);
    }
    for hash in [&record.graph_sha256, &record.provenance_sha256] {
        if hash.len() != 64 || !hash.bytes().all(|c| c.is_ascii_hexdigit()) {
            return Ok(false);
        }
    }
    let saved = fs::read(ledger_path(root, record))?;
    let canonical = serde_json::to_vec_pretty(record).map_err(io::Error::other)?;
    if saved != canonical {
        return Ok(false);
    }
    let graph = restore(root, &record.graph_manifest)?;
    let provenance = restore(root, &record.provenance_manifest)?;
    if digest(&graph) != record.graph_sha256 || digest(&provenance) != record.provenance_sha256 {
        return Ok(false);
    }
    let parsed: ReasoningGraph = serde_json::from_slice(&graph).map_err(io::Error::other)?;
    Ok(canonical_graph(&parsed)? == graph)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{sync::Arc, thread};

    #[test]
    fn graph_ingest_is_idempotent_and_recoverable() {
        let dir = tempfile::tempdir().unwrap();
        let graph = ReasoningGraph {
            schema: "tsm.reasoning-graph.v1".into(), nodes: vec![], edges: vec![]
        };
        let prov = br#"{"source":"test fixture","review_state":"UNVERIFIED"}"#;
        let a = ingest_graph(dir.path(), &graph, prov, ChunkConfig::default()).unwrap();
        let b = ingest_graph(dir.path(), &graph, prov, ChunkConfig::default()).unwrap();
        assert_eq!(a.graph_sha256, b.graph_sha256);
        assert_eq!(a.review_state, "UNVERIFIED");
        assert!(verify_record(dir.path(), &a).unwrap());
        let path = dir.path().join("objects")
            .join(&a.provenance_manifest.chunks[0].sha256[..2])
            .join(&a.provenance_manifest.chunks[0].sha256);
        fs::write(path, b"corruption").unwrap();
        assert!(verify_record(dir.path(), &a).is_err());
    }

    #[test]
    fn concurrent_writers_are_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        let root = Arc::new(dir.path().to_path_buf());
        let handles: Vec<_> = (0..8).map(|_| {
            let root = Arc::clone(&root);
            thread::spawn(move || {
                let graph = ReasoningGraph {
                    schema: "tsm.reasoning-graph.v1".into(), nodes: vec![], edges: vec![]
                };
                ingest_graph(&root, &graph, br#"{"source":"fixture"}"#, ChunkConfig::default())
            })
        }).collect();
        let records: Vec<_> = handles.into_iter().map(|h| h.join().unwrap().unwrap()).collect();
        assert!(records.iter().all(|r| r.graph_sha256 == records[0].graph_sha256));
        assert!(verify_record(&root, &records[0]).unwrap());
        assert_eq!(fs::read_dir(root.join("ledger")).unwrap().count(), 1);
    }
}

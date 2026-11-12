//! Append-only, crash-safe evidence manifest adapter.
//! Persisting a ledger record is distinct from approving its scientific claims.
use crate::{graph::{canonical_graph, ReasoningGraph}, store, ChunkConfig, Manifest};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{fs, io, path::Path, sync::atomic::{AtomicU64, Ordering}};
static NEXT_LEDGER_TEMP: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EvidenceRecord {
    pub schema: String,
    pub graph_sha256: String,
    pub provenance_sha256: String,
    pub storage_manifest: Manifest,
    pub review_state: String,
}
fn digest(data: &[u8]) -> String { format!("{:x}", Sha256::digest(data)) }

/// Canonical graph and source provenance are stored separately. The caller
/// supplies already validated provenance bytes; no authority is inferred.
pub fn ingest_graph(root: &Path, graph: &ReasoningGraph, provenance: &[u8],
                    config: ChunkConfig) -> io::Result<EvidenceRecord> {
    if provenance.is_empty() || provenance.len() > 1024 * 1024 {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "provenance required (max 1 MiB)"));
    }
    let bytes = canonical_graph(graph)?;
    let manifest = store(root, &bytes, config)?;
    let record = EvidenceRecord {
        schema: "tsm.sde.evidence-record.v1".into(),
        graph_sha256: digest(&bytes),
        provenance_sha256: digest(provenance),
        storage_manifest: manifest,
        review_state: "UNVERIFIED".into(),
    };
    let ledger = root.join("ledger");
    fs::create_dir_all(&ledger)?;
    let name = format!("{}-{}.json", record.graph_sha256, record.provenance_sha256);
    let target = ledger.join(name);
    let serialized = serde_json::to_vec_pretty(&record).map_err(io::Error::other)?;
    // Publish complete ledger JSON atomically; no reader observes partial data.
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
    let existing: EvidenceRecord = serde_json::from_slice(&fs::read(&target)?).map_err(io::Error::other)?;
    if existing.graph_sha256 != record.graph_sha256
        || existing.provenance_sha256 != record.provenance_sha256
        || existing.storage_manifest.source_sha256 != record.storage_manifest.source_sha256 {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "conflicting ledger record"));
    }
    Ok(record)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn graph_ingest_is_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        let graph = ReasoningGraph { schema:"tsm.reasoning-graph.v1".into(), nodes:vec![], edges:vec![] };
        let a = ingest_graph(dir.path(), &graph, b"test provenance", ChunkConfig::default()).unwrap();
        let b = ingest_graph(dir.path(), &graph, b"test provenance", ChunkConfig::default()).unwrap();
        assert_eq!(a.graph_sha256, b.graph_sha256);
        assert_eq!(a.review_state, "UNVERIFIED");
    }
}

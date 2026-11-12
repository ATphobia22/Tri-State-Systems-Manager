//! Sovereign Deduplication Engine (SDE).
//!
//! Offline, content-defined chunking using a GF(2) Rabin rolling polynomial
//! fingerprint (degree 53), with SHA-256 object identities. The rolling
//! fingerprint selects boundaries; it is NOT a cryptographic content hash.
//! Feed canonical serialized subgraph bytes to get stable cross-run identities.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::sync::atomic::{AtomicU64, Ordering};
static NEXT_TEMP: AtomicU64 = AtomicU64::new(0);
use std::io;
use std::path::{Path, PathBuf};

// Degree-53 irreducible polynomial (used for GF(2) Rabin rolling digests).
// Boundary rolling hashes are NOT cryptographic hashes; SHA-256 identifies data.
const RABIN_POLYNOMIAL: u64 = 0x3DA3358B4DC173;
const RABIN_DEGREE: usize = 53;
const WINDOW: usize = 64;
pub mod graph;
pub mod evidence;
pub mod parallel;

fn rabin_append(fp: u64, byte: u8) -> u64 {
    let mut value = (fp << 8) ^ u64::from(byte);
    for bit in (RABIN_DEGREE..=(RABIN_DEGREE + 7)).rev() {
        if value & (1u64 << bit) != 0 {
            value ^= RABIN_POLYNOMIAL << (bit - RABIN_DEGREE);
        }
    }
    value
}

fn rabin_out_table() -> [u64; 256] {
    let mut table = [0u64; 256];
    for (byte, value) in table.iter_mut().enumerate() {
        let mut fp = rabin_append(0, byte as u8);
        for _ in 1..WINDOW { fp = rabin_append(fp, 0); }
        *value = fp;
    }
    table
}

#[derive(Debug, Clone, Copy)]
pub struct ChunkConfig {
    pub min: usize,
    pub avg: usize,
    pub max: usize,
}
impl Default for ChunkConfig {
    fn default() -> Self { Self { min: 4 * 1024, avg: 16 * 1024, max: 64 * 1024 } }
}
impl ChunkConfig {
    pub fn validate(self) -> io::Result<Self> {
        if self.min == 0 || self.min > self.avg || self.avg > self.max
            || !self.avg.is_power_of_two() || self.max > 16 * 1024 * 1024 {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, "invalid CDC configuration"));
        }
        Ok(self)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ChunkRef {
    pub sha256: String,
    pub bytes: usize,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub schema: String,
    pub source_sha256: String,
    pub source_bytes: usize,
    pub chunks: Vec<ChunkRef>,
}

fn hash(bytes: &[u8]) -> String { format!("{:x}", Sha256::digest(bytes)) }

/// Sliding-window Rabin fingerprint in GF(2), with polynomial reduction.
/// The final boundary is forced at the end of the byte stream.
pub fn boundaries(bytes: &[u8], cfg: ChunkConfig) -> io::Result<Vec<(usize, usize)>> {
    let cfg = cfg.validate()?;
    let outgoing = rabin_out_table();
    let mut result = Vec::new();
    let mut start = 0;
    let mut fp = 0u64;
    let mut ring = [0u8; WINDOW];
    for (i, &byte) in bytes.iter().enumerate() {
        let idx = i % WINDOW;
        if i >= WINDOW {
            fp ^= outgoing[ring[idx] as usize];
        }
        fp = rabin_append(fp, byte);
        ring[idx] = byte;
        let length = i + 1 - start;
        if length >= cfg.min && ((fp & ((cfg.avg - 1) as u64)) == 0 || length >= cfg.max) {
            result.push((start, i + 1));
            start = i + 1;
        }
    }
    if start < bytes.len() { result.push((start, bytes.len())); }
    Ok(result)
}

fn object_path(root: &Path, digest: &str) -> PathBuf {
    root.join("objects").join(&digest[..2]).join(digest)
}

/// Persist chunks by SHA-256. Existing objects are verified before reuse.
/// A corrupt object causes a hard error instead of silent data substitution.
pub fn store(root: &Path, source: &[u8], cfg: ChunkConfig) -> io::Result<Manifest> {
    let spans = boundaries(source, cfg)?;
    let mut refs = Vec::with_capacity(spans.len());
    for (start, end) in spans {
        let chunk = &source[start..end];
        let digest = hash(chunk);
        let path = object_path(root, &digest);
        fs::create_dir_all(path.parent().unwrap())?;
        if !path.exists() {
            // Stage a complete, fsynced object under a unique temporary name.
            // Atomic hard-link publish prevents readers seeing partially written
            // chunks and never replaces an existing content-addressed object.
            let sequence = NEXT_TEMP.fetch_add(1, Ordering::Relaxed);
            let temp = path.with_extension(format!("tmp-{}-{sequence}", std::process::id()));
            let publish = (|| -> io::Result<()> {
                use std::io::Write;
                let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&temp)?;
                file.write_all(chunk)?;
                file.sync_all()?;
                drop(file);
                match fs::hard_link(&temp, &path) {
                    Ok(()) => Ok(()),
                    Err(err) if err.kind() == io::ErrorKind::AlreadyExists => Ok(()),
                    Err(err) => Err(err),
                }
            })();
            let _ = fs::remove_file(&temp);
            publish?;
        }
        // Even if another writer published during our staging, verify bytes.
        if fs::read(&path)? != chunk {
            return Err(io::Error::new(io::ErrorKind::InvalidData,
                "object hash collision or corruption"));
        }
        refs.push(ChunkRef { sha256: digest, bytes: chunk.len() });
    }
    Ok(Manifest {
        schema: "tsm.sde.manifest.v1".into(),
        source_sha256: hash(source),
        source_bytes: source.len(),
        chunks: refs,
    })
}

pub fn restore(root: &Path, manifest: &Manifest) -> io::Result<Vec<u8>> {
    if manifest.schema != "tsm.sde.manifest.v1" || manifest.source_bytes > 1024 * 1024 * 1024 {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "unsupported manifest or size"));
    }
    let mut output = Vec::with_capacity(manifest.source_bytes);
    for entry in &manifest.chunks {
        if entry.sha256.len() != 64 || !entry.sha256.bytes().all(|c| c.is_ascii_hexdigit()) {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, "invalid object digest"));
        }
        if entry.bytes > 16 * 1024 * 1024 || output.len().saturating_add(entry.bytes) > manifest.source_bytes {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, "invalid object size"));
        }
        let bytes = fs::read(object_path(root, &entry.sha256))?;
        if bytes.len() != entry.bytes || hash(&bytes) != entry.sha256 {
            return Err(io::Error::new(io::ErrorKind::InvalidData, "chunk integrity failure"));
        }
        output.extend(bytes);
    }
    if output.len() != manifest.source_bytes || hash(&output) != manifest.source_sha256 {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "reconstructed source integrity failure"));
    }
    Ok(output)
}

#[derive(Debug, Serialize)]
pub struct StorageMetrics {
    pub logical_bytes: usize,
    pub unique_chunk_bytes: usize,
    pub unique_chunks: usize,
    pub total_chunk_references: usize,
    pub dedup_ratio: f64,
    pub saved_fraction: f64,
}
pub fn metrics(manifests: &[Manifest]) -> StorageMetrics {
    let mut seen = HashSet::new();
    let mut unique = 0usize;
    let mut logical = 0usize;
    let mut count = 0usize;
    for manifest in manifests {
        logical += manifest.source_bytes;
        for chunk in &manifest.chunks {
            count += 1;
            if seen.insert(&chunk.sha256) { unique += chunk.bytes; }
        }
    }
    StorageMetrics {
        logical_bytes: logical, unique_chunk_bytes: unique,
        unique_chunks: seen.len(), total_chunk_references: count,
        dedup_ratio: if unique == 0 { 1.0 } else { logical as f64 / unique as f64 },
        saved_fraction: if logical == 0 { 0.0 } else { 1.0 - unique as f64 / logical as f64 },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn roundtrip_and_dedup() {
        let tmp = tempfile::tempdir().unwrap();
        let bytes = vec![b'a'; 180_000];
        let a = store(tmp.path(), &bytes, ChunkConfig::default()).unwrap();
        let b = store(tmp.path(), &bytes, ChunkConfig::default()).unwrap();
        assert_eq!(restore(tmp.path(), &a).unwrap(), bytes);
        let m = metrics(&[a, b]);
        assert!(m.saved_fraction >= 0.5);
    }
    #[test]
    fn corruption_detected() {
        let tmp = tempfile::tempdir().unwrap();
        let a = store(tmp.path(), b"hello", ChunkConfig::default()).unwrap();
        let path = object_path(tmp.path(), &a.chunks[0].sha256);
        fs::write(path, b"bad").unwrap();
        assert!(restore(tmp.path(), &a).is_err());
    }
    #[test]
    fn rabin_window_matches_recalculation() {
        let stream: Vec<u8> = (0..512).map(|n| ((n * 73) % 251) as u8).collect();
        let outgoing = rabin_out_table();
        let mut fp = 0u64;
        let mut ring = [0u8; WINDOW];
        for (i, byte) in stream.iter().copied().enumerate() {
            let idx = i % WINDOW;
            if i >= WINDOW { fp ^= outgoing[ring[idx] as usize]; }
            fp = rabin_append(fp, byte);
            ring[idx] = byte;
            let start = (i + 1).saturating_sub(WINDOW);
            let recomputed = stream[start..=i].iter().fold(
                0u64, |hash, b| rabin_append(hash, *b)
            );
            assert_eq!(fp, recomputed, "window ending at {i}");
        }
    }
    #[test]
    fn stable_boundaries_and_empty() {
        let cfg = ChunkConfig::default();
        let data = vec![17u8; 100_000];
        assert_eq!(boundaries(&data, cfg).unwrap(), boundaries(&data, cfg).unwrap());
        assert!(boundaries(&[], cfg).unwrap().is_empty());
        assert!(boundaries(&data, ChunkConfig { min: 0, ..cfg }).is_err());
    }
}

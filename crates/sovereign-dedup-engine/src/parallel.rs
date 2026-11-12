//! Bounded parallel candidate evaluation for neural-assisted reasoning.
//! Inference is supplied by a caller-owned model adapter; no model is bundled.
//! Scores are heuristic/model outputs, NOT evidence or scientific authority.
use std::{io, sync::Arc, thread};

#[derive(Clone, Debug)]
pub struct Candidate {
    pub id: String,
    pub graph_digest: String,
    pub hypothesis: String,
}
#[derive(Clone, Debug)]
pub struct Evaluation {
    pub candidate_id: String,
    pub model_id: String,
    pub score: f64,
    pub rationale: String,
}
pub trait Reasoner: Send + Sync + 'static {
    fn evaluate(&self, candidate: &Candidate) -> Result<Evaluation, String>;
}
/// Evaluate candidates concurrently with a bounded number of workers.
/// Return a stable candidate-id ordering, independent of scheduling.
pub fn evaluate_parallel(
    candidates: Vec<Candidate>,
    reasoner: Arc<dyn Reasoner>,
    workers: usize,
) -> io::Result<Vec<Evaluation>> {
    if workers == 0 || workers > 32 || candidates.len() > 4096 {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "invalid parallel reasoning bounds"));
    }
    let mut ids = std::collections::HashSet::new();
    for c in &candidates {
        if c.id.is_empty() || c.id.len() > 256 || c.hypothesis.is_empty()
            || c.hypothesis.len() > 64 * 1024
            || c.graph_digest.len() != 64
            || !c.graph_digest.bytes().all(|b| b.is_ascii_hexdigit())
            || !ids.insert(c.id.clone()) {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, "invalid candidate"));
        }
    }
    let mut results = Vec::new();
    for batch in candidates.chunks(workers) {
        let mut handles = Vec::new();
        for candidate in batch.iter().cloned() {
            let model = Arc::clone(&reasoner);
            handles.push(thread::spawn(move || {
                let expected_id = candidate.id.clone();
                (expected_id, model.evaluate(&candidate))
            }));
        }
        for handle in handles {
            let (expected_id, response) =
                handle.join().map_err(|_| io::Error::other("reasoning worker panicked"))?;
            let evaluation = response.map_err(io::Error::other)?;
            if evaluation.candidate_id != expected_id || evaluation.model_id.is_empty()
                || evaluation.model_id.len() > 256 || evaluation.rationale.len() > 64 * 1024
                || !evaluation.score.is_finite()
                || !(0.0..=1.0).contains(&evaluation.score) {
                return Err(io::Error::new(io::ErrorKind::InvalidData, "invalid or mislabeled model evaluation"));
            }
            results.push(evaluation);
        }
    }
    results.sort_by(|a,b| a.candidate_id.cmp(&b.candidate_id));
    Ok(results)
}
#[cfg(test)]
mod tests {
    use super::*;
    struct Stub;
    impl Reasoner for Stub {
        fn evaluate(&self, c: &Candidate) -> Result<Evaluation,String> {
            Ok(Evaluation { candidate_id:c.id.clone(), model_id:"deterministic-test-stub".into(),
                score:0.5, rationale:"test only".into() })
        }
    }
    #[test]
    fn stable_parallel_order() {
        let candidates = (0..12).rev().map(|n| Candidate {
            id: format!("{n:02}"), graph_digest:"a".repeat(64), hypothesis:"test".into()
        }).collect();
        let results = evaluate_parallel(candidates, Arc::new(Stub), 4).unwrap();
        assert_eq!(results[0].candidate_id, "00");
        assert_eq!(results[11].candidate_id, "11");
    }
}

//! Deterministic, versioned serialization for evidence reasoning DAGs.
//! This is NOT RFC 8785 JCS: it is a constrained TSM-specific JSON contract.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::io;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReasoningNode {
    pub id: String,
    pub kind: String,
    pub payload: Value,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReasoningEdge {
    pub from: String,
    pub to: String,
    pub relation: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReasoningGraph {
    pub schema: String,
    pub nodes: Vec<ReasoningNode>,
    pub edges: Vec<ReasoningEdge>,
}
fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, message)
}
/// Canonical bytes require unique node IDs, valid edge references, and sorted
/// node/edge order. serde_json's BTreeMap-backed object order is deterministic.
/// Consumers must pin the serialization version across languages.
pub fn canonical_graph(graph: &ReasoningGraph) -> io::Result<Vec<u8>> {
    if graph.schema != "tsm.reasoning-graph.v1" {
        return Err(invalid("unsupported reasoning graph schema"));
    }
    if graph.nodes.len() > 100_000 || graph.edges.len() > 500_000 {
        return Err(invalid("graph size limit exceeded"));
    }
    let mut normalized = graph.clone();
    let mut ids = HashSet::new();
    for node in &normalized.nodes {
        if node.id.is_empty() || node.id.len() > 256 || node.kind.is_empty() || !ids.insert(&node.id) {
            return Err(invalid("invalid or duplicate node ID"));
        }
    }
    for edge in &normalized.edges {
        if !ids.contains(&edge.from) || !ids.contains(&edge.to) || edge.relation.is_empty() {
            return Err(invalid("dangling edge or empty relation"));
        }
    }
    normalized.nodes.sort_by(|a, b| a.id.cmp(&b.id));
    normalized.edges.sort_by(|a, b|
        (&a.from, &a.to, &a.relation).cmp(&(&b.from, &b.to, &b.relation)));
    for pair in normalized.edges.windows(2) {
        if pair[0].from == pair[1].from && pair[0].to == pair[1].to
            && pair[0].relation == pair[1].relation {
            return Err(invalid("duplicate edge"));
        }
    }
    serde_json::to_vec(&normalized).map_err(io::Error::other)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn graph_order_is_deterministic() {
        let a = ReasoningGraph {
            schema: "tsm.reasoning-graph.v1".into(),
            nodes: vec![
                ReasoningNode { id: "b".into(), kind: "observation".into(), payload: json!({"z":2,"a":1}) },
                ReasoningNode { id: "a".into(), kind: "source".into(), payload: json!({"value":3}) },
            ],
            edges: vec![ReasoningEdge { from:"a".into(), to:"b".into(), relation:"supports".into() }],
        };
        let mut b = a.clone();
        b.nodes.reverse();
        assert_eq!(canonical_graph(&a).unwrap(), canonical_graph(&b).unwrap());
    }
    #[test]
    fn rejects_dangling_edges() {
        let g = ReasoningGraph { schema: "tsm.reasoning-graph.v1".into(), nodes: vec![],
            edges: vec![ReasoningEdge { from:"missing".into(), to:"other".into(), relation:"supports".into() }] };
        assert!(canonical_graph(&g).is_err());
    }
}

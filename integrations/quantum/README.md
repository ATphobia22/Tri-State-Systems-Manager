# Quantum Research Capability Boundary

The approved OpenFermion-Cirq source is archived and deprecated. TSM therefore treats it as a historical/research reference and does **not** add it as a production dependency.

## Required isolation

- Research workflow is opt-in.
- Inputs and outputs are schema-defined and content-addressed.
- `output_classification` must be `research-only`.
- `authoritative_mutation` must be `false`.
- Quantum results cannot become regulatory, public-safety, or evidence-ledger truth without an independent engineering validation path outside the quantum adapter.

The integration point is intentionally a contract boundary so the research implementation can later be replaced by maintained OpenFermion/Cirq-compatible components without changing TSM's authoritative planes.

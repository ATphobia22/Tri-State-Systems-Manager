# External Capability Registry

`capabilities.json` is the authoritative inventory of external repositories permitted to influence TSM engineering workflows.

## Registry invariants

- `ref_type` is always `commit`.
- `ref` is always a 40-character commit SHA.
- Every capability has explicit allowed and forbidden uses.
- Licensing is recorded as a policy, not inferred as permission to redistribute.
- Security classification and runtime boundary are mandatory.
- Deprecated sources remain explicitly marked and cannot silently become production dependencies.

CI validates these invariants before application parsing, typechecking, building, or testing.

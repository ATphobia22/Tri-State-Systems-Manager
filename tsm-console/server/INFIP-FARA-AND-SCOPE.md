# INFIP / FARA — TSM Scope (minimal)

## Needed for system goals

1. **INFIP** is the public DNR tool for floodplain + BFE display (FEMA effective + Best Available).
2. **FARA** is required when: Zone A; LOMA in Zone A; upstream DA > 1 sq mi; unmapped FIRM; known flood-prone.
3. TSM **links** to INFIP (`in.gov/infip`) and may store a **user-provided** FARA PDF as an EvidenceArtifact (`REGULATORY` / `human_authorized`).
4. TSM **does not** generate or approve FARA or floodway permits (IC 14-28-1 remains with DNR ESC).

## Supporting DNR resources (reference)

- State Engineering Resources: modeling guidelines, INFIP/eFARA, permit review under Flood Control Act
- H&H Model Library: prior FIS / floodway / FARA models
- Homeowner floodplain management information: public accountability / education

## Not added

- Unrelated ArcGIS experience apps without clear floodplain authority role
- Third-party directories already covered
- **ansible-aws-vpc-ha-wordpress**: separate ops repo (public). Useful only as optional IaC pattern for future TSM hosting — **not** imported into the evidence or floodplain stack


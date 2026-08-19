# DNR Cumulative Impact · FEMA Floodway Encroachment

## Indiana DNR cumulative impact policy

**Regulatory text (312 IAC 10-2-3)**  
“Adversely affect the efficiency of, or unduly restrict the capacity of, the floodway” means an increase in the elevation of the **regulatory flood of at least 0.15 ft** comparing project condition to base condition (exceptions: certain dams, authorized flood-control projects, recorded flood easements).

**DNR public practice (No-Rise guidance page)**  
- Under the **Flood Control Act**, DNR still regulates to a **0.14 ft cumulative surcharge**.  
- Local ordinances often restate: development alone or combined with existing/anticipated development shall not increase the regulatory flood more than **0.14 ft**.  
- **Cumulative** = proposed + existing + anticipated development, not only the single project in isolation.

**Dual track when site is in a FEMA floodway**  
1. **DNR** Construction in a Floodway permit (state criteria, including cumulative surcharge policy).  
2. **NFIP / local**: **0.00 ft** No-Rise certification **or** CLOMR before construction and LOMR after — FEMA no longer treats a DNR permit alone as satisfying 44 CFR 60.3(d)(3) “no increase.”

TSM surfaces both tracks as citations; PE models and permits remain external EvidenceArtifacts.

## FEMA floodway encroachment guidelines

- Regulatory floodway reserved so base flood discharge can pass with **cumulative** WSE increase **not exceeding a designated amount** (NFIP default **≤ 1.0 ft**; state/local may be stricter — Indiana FEMA-floodway practice for *development* is effectively **0.00** via No-Rise).  
- Standard mapping approach: **equal reduction of conveyance** (equal degree of encroachment) on opposite sides of the stream — not necessarily equal width.  
- HEC-RAS Methods 1–5 implement encroachment; Method 4 targets a specified rise.  
- Surcharge maps compare encroached vs base plans.  
- Communities must not permit floodway development that increases base flood levels (strict “no rise” interpretation for the NFIP floodway unless map is revised).

## TSM implementation note

Store in Governance plane as machine-readable policy citations (already aligned with `jurisdiction-rules.ts` / surcharge docs). Auto-fill of *regulatory* determinations remains forbidden.


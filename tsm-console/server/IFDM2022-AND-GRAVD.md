# IFDM2022 · GRAV-D — TSM watch notes

## IFDM2022 (Intra-Frame Deformation Model)

Formerly discussed as **IFVM2022**. Complements **EPP2022**:

| Model | Changes frame? | Changes epoch? | Content |
|-------|----------------|----------------|---------|
| **EPP2022** | Yes (ITRF2020 → NATRF2022, etc.) | No | Rigid Euler-pole rotation (3 Ω components) |
| **IFDM2022** | No (intra = inside the plate frame) | **Yes** | Residual horizontal motion after EPP + **vertical** motion (GIA, subsidence, etc.) |

NATRF2022 beta EPP example (mas/yr, NGS beta): Ωx≈0.046, Ωy≈−0.704, Ωz≈−0.047; reference epoch **2020.0**.

Coordinates on the stable interior should drift slowly in NATRF2022; residual IFDM still captures local effects. HTDP historically lacked full vertical velocity support outside limited regions; IFDM is designed to include vertical.

**TSM:** `buildModernizationWatchChain()` records EPP+IFDM template steps. `alters_orthometric_site_constants: false` required. Analysis remains **2966+NAVD88** until Indiana practice adopts modernized products.

## GRAV-D

**Gravity for the Redefinition of the American Vertical Datum** — airborne gravity snapshot (campaign complete Dec 2023) + **GeMS** (time-varying gravity “movie”).

- Feeds **xGEOID** experimental series (type A without / type B with airborne gravity)
- Underpins **GEOID2022** / **NAPGD2022** (purely gravimetric geoid path)
- **GEOID18** remains last **hybrid** (GPS-on-BM constrained to NAVD88)
- **GRAV-D FO** (Follow On) continues data collection for future product updates

TSM vertical chain for current work still cites **GEOID18** for \(H \approx h - N\) into **NAVD88**. GRAV-D is metadata on that lineage, not a silent height rewrite.


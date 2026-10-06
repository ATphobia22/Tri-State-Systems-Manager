# 312 IAC 10 — Verified Rule Excerpts

**Source:** `~/workspace/tsm-forms/flood/Indiana-312-IAC-10-Flood-Plain-Management-2026.pdf`,
text-extracted 2026-10-06 (3,261 lines). Citations below quote the extracted
rule text verbatim.

## VERIFIED: the 0.15 ft threshold — 312 IAC 10-2-3

> **312 IAC 10-2-3 "'Adversely affect the efficiency of, or unduly restrict the
> capacity of, the floodway' defined**
> Authority: IC 14-28-1-5; IC 14-28-3-2 …
> Sec. 3. "'Adversely affect the efficiency of, or unduly restrict the capacity
> of, the floodway' means an increase in the elevation of the regulatory flood
> of **at least fifteen-hundredths (0.15) of a foot** as determined by comparing
> the regulatory flood elevation under the project condition to that under the
> base condition. This definition does not, however, apply to any of the
> following: (1) A dam regulated under IC 14-27-7 and IC 14-28-1. (2) A flood
> control project authorized under IC 14-28-1-29. (3) An area for which a flood
> easement is secured and recorded with the county recorder."
> (filed Jul 5, 2001, eff Jan 1, 2002; readopted 2008, 2014, 2020)

This is the rule `backend/governance/archimedes_engine.py` already encodes.
TSM screening uses 0.15 ft as the Indiana adverse-effect criterion.

## EXPLICITLY NOT FOUND in the extracted rule text

Searched the full 3,261-line extraction (case-insensitive):

- **No "1.20x" or "1.2x" compensatory-storage multiplier.** The string
  "compensatory storage" does not appear at all. The only "storage" hit in the
  entire rule is "a gas or liquid storage tank that is principally aboveground"
  (an unrelated definition). Any document claiming a 1.20x statutory mandate
  under 312 IAC 10 is contradicted by the rule text itself.
- **No 2.0-ft freeboard mandate.** The string "freeboard" does not appear in
  the rule text at all.
- **No "no-rise" language.** The phrase "no-rise"/"no rise" does not appear in
  the rule text. (Indiana DNR's *guidance* page on FEMA-mapped floodways
  separately discusses 0.00 ft demonstrations and the CLOMR/LOMR path; that is
  guidance, not this rule.)

## Related form references (for context, not rule text)

- State Form 57132 (fish/wildlife/botanical worksheet) cites its authority as
  "the Flood Control Act, IC 14-28-1 and the Floodplain Management rules,
  312 IAC 10" — consistent with the above.
- State Form 55235 accepts BFE from: published FIS/flood study, LOMR (with
  case #), approved DNR-permit models (with permit #), or DNR FARA — always
  with BFE value **and datum**.

## Correction status

Repo documents previously claiming a 1.20x mandate, a 2-ft freeboard mandate,
or a "312 IAC 10-6-3 volumetric compensatory storage requirement" now carry
2026-10-06 correction notices pointing here. This file is the verified record;
cite it, not the superseded claims.

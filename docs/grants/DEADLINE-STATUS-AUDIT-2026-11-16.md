# 47620 Grant Matrix — recorded-deadline staleness audit

**Audit date:** November 16, 2026 (UTC). **Input:** [unaltered October 8, 2026 CSV](47620-Grant-Master-Matrix-2026-10-08.csv). **Scope:** deterministic source-data check, not live government NOFO verification.

## Finding

Of the **50 program rows** in the archived matrix, **12** retain the literal status **OPEN** while their **recorded application deadline** has passed by the audit date.

This proves only an **inconsistency between the archived status field and the recorded calendar**. It does *not* establish that the government opportunity is definitively closed, extended, reissued or eligible for a particular sponsor. Changes must be confirmed on the issuing agency's current official page. The historical CSV is preserved to keep its provenance and should not be silently rewritten.

| Program ID | Archived status | Recorded application deadline | Audit result |
|---|---|---|---|
| DOJ-JAG-2026 | OPEN | 2026-10-16 | HISTORICAL_OPEN_PAST_RECORDED_DEADLINE |
| DOJ-RVC-2026 | OPEN | 2026-11-06 | HISTORICAL_OPEN_PAST_RECORDED_DEADLINE |
| DOJ-ANGEL-2026 | OPEN | 2026-10-27 | HISTORICAL_OPEN_PAST_RECORDED_DEADLINE |
| DOJ-COLD-DNA-2026 | OPEN | 2026-11-05 | HISTORICAL_OPEN_PAST_RECORDED_DEADLINE |
| DOJ-STOP-SV-2026 | OPEN | 2026-11-06 | HISTORICAL_OPEN_PAST_RECORDED_DEADLINE |
| DOJ-COVERDELL-C-2026 | OPEN | 2026-11-05 | HISTORICAL_OPEN_PAST_RECORDED_DEADLINE |
| DOJ-COVERDELL-F-2026 | OPEN | 2026-11-06 | HISTORICAL_OPEN_PAST_RECORDED_DEADLINE |
| DOJ-CEBR-F-2026 | OPEN | 2026-11-05 | HISTORICAL_OPEN_PAST_RECORDED_DEADLINE |
| DOJ-CEBR-C-2026 | OPEN | 2026-11-10 | HISTORICAL_OPEN_PAST_RECORDED_DEADLINE |
| IN-ICJI-LEPP-FY27 | OPEN | 2026-10-14 | HISTORICAL_OPEN_PAST_RECORDED_DEADLINE |
| IDHS-HMEP-FY27 | OPEN | 2026-11-05 16:30 ET | HISTORICAL_OPEN_PAST_RECORDED_DEADLINE |
| IDHS-EMPG-S-FY26 | OPEN | 2026-11-05 16:30 ET | HISTORICAL_OPEN_PAST_RECORDED_DEADLINE |

## Method and interpretation

- Compared the **date component** (YYYY-MM-DD) of the CSV **Application_Deadline** column to **2026-11-16**; includes timed cells such as November 5 at 16:30 Eastern.
- Restricted the stale-open count to an **exact literal OPEN** label. Other values such as “Open / continuous,” “cycle-dependent” and rows with no deadline **cannot** be validated by this date comparison.
- Did **not** call agency portals to independently adjudicate all 50 listed statuses, current notices, revised deadlines, applicant eligibility, awards or cost shares.
- Keep the October 8 CSV as a dated historical planning snapshot. On refresh, version the new register with **per-opportunity source URL, retrieved_at, issued/posted date, verified closing date, sponsor eligibility, NOFO ID, program/fiscal year and verification status**.
- An updated notice must be linked to the relevant official agency or [Grants.gov](https://www.grants.gov/) / [Simpler.Grants.gov](https://simpler.grants.gov/) record. [SAM.gov Assistance Listings](https://sam.gov/content/assistance-listings) is program authority, not evidence an application window is open.

**Separately checked example:** [FEMA FY2026 Flood Mitigation Assistance, DHS-26-MT-029-000-98](https://simpler.grants.gov/opportunity/aca6c6dc-72d9-4b69-b9ca-235a828f6144) was posted October 22, 2026, and listed a February 26, 2027 closing date when checked November 16, 2026. This is *not* an eligibility or award determination for TSM.

No application may be auto-submitted. Human and agency authority remain final.

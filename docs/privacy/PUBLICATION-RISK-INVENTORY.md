# Public publication-risk inventory (informational)

**Release gate:** Issue #418 remains OWNER_PRIVACY_REVIEW_REQUIRED. This
inventory is a review aid, never approval to publish a site-specific record.

Run the Python unittest discovery under scripts/privacy, then run
python scripts/privacy/publication_risk_inventory.py with an optional --output
path for the JSON aggregate report.

The scan uses tracked candidate public/runtime files under tsm-console/public,
tsm-console/src, docs, data and artifacts. Its JSON and CI logs contain
**only category counts**, inspected/uninspected file counts and status flags.
They contain **no matching snippets, filenames or precise coordinates**.
Heuristics may flag legitimate public government geometry and may miss
site-specific data. Large files, binary formats and file metadata are
**not scanned**. Historical Git commits, Pages releases, caches, external
links, attached photos and publication authorization are not audited here.

A successful CI job means aggregate scanning and synthetic regression tests
ran—not that all private data is absent. The owner or authorized custodian
must separately review each sensitive AOI, source permissions, historical
exposure, and any required private evidence isolation. Existing owner
disclosure decisions remain separate from scientific and regulatory signoff.
No automatic redaction or history rewrite is performed.

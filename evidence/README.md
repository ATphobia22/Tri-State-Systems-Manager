# Evidence and Provenance

Tracked evidence manifests contain non-secret provenance metadata and cryptographic hashes. They are intended to make source artifacts reproducible and tamper-evident without placing private credentials in the repository.

## Rules

1. Store only public/non-secret metadata and SHA-256 digests in tracked manifests.
2. Keep original sensitive artifacts outside Git unless there is an explicit legal and security basis to publish them.
3. Use SHA-256 for artifact identity.
4. Record the artifact's source label, acquisition/creation context, and digest.
5. Do not put names, addresses, policy numbers, credentials, or other unnecessary PII into manifests.
6. Treat a matching digest as evidence that the bytes are unchanged; it does not by itself establish authenticity or legal/regulatory validity.

Local secret material belongs in `.secrets/` and is ignored by Git.

# Canonical bootstrap migration repair

Baseline: `44e16dcfda599964c2a827b4dd2db493ce470141`.

The existing `scripts/run_migrations.py` remains the canonical runner. It now creates its ledger before querying a fresh database, compares stored digests before applying pending work, checks discovered bytes again before execution, and excludes concurrent canonical runners with a session advisory lock. A legacy null checksum is explicitly warned about and left null; current file bytes cannot establish historical execution bytes.

Trusted repository SQL containing an ordinary outer BEGIN/COMMIT pair is executed under the connection transaction, with its ledger write. Embedded top-level transaction controls are rejected. This is not an SQL security sandbox or a runner for operations that require autocommit. Use a dedicated non-autocommit connection and the existing TSM_POSTGRES_DSN configuration. No new database server, table ownership scheme, default password, production migration or alternate package namespace is introduced.

`backend/tests/test_migration_runner.py` covers discovery, rollback, drift, source mutation, unsupported transaction controls and lock contention using DBAPI fakes. `backend/tests/test_migration_runner_postgres.py` creates disposable uniquely named databases on an explicitly configured test server to verify first bootstrap/rerun, drift before pending DDL, wrapped DDL rollback after a ledger-write failure, session-lock release and legacy null digest disclosure. CI supplies PostgreSQL 17; local integration tests skip when TSM_TEST_POSTGRES_DSN is absent. These tests do not claim that every application migration has been applied to a production PostGIS database.

The old bootstrap and ingestion branches are still retained. Their alternate service deployment, conflicting schema definitions and transactional imported-asset promotion remain separate unresolved work; this repair does not mark them wholly merged.

PostgreSQL session-lock behavior: https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS

Psycopg transaction behavior: https://www.psycopg.org/docs/connection.html

SQL parser release/security notes: https://sqlparse.readthedocs.io/en/stable/changes.html

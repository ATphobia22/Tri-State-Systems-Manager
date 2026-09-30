# Production release marker

This file is intentionally non-runtime and exists to provide an explicit deployment provenance boundary for authorized API deployment.

The API is deployed from the repository by authorized API deployment using the `tsm-console/Dockerfile` and repository-root build context. authorized API deployment must deploy the exact Git commit being published so the production Pages exact-SHA readiness gate can converge.

The release marker is updated only when a production Pages/API release must converge to the same Git commit. authorized API deployment production build context is the repository root with `tsm-console/Dockerfile` as the Dockerfile.

# Production release marker

This file is intentionally non-runtime and exists to provide an explicit watched-tree deployment boundary for Railway.

Railway watches `/tsm-console/**`. Changes that only modify CI/workflow files do not produce a new API deployment, which can otherwise prevent the production Pages exact-SHA readiness gate from converging.

The release marker is updated only when a production Pages/API release must converge to the same Git commit. Railway production build context is the repository root with `tsm-console/Dockerfile` as the Dockerfile.

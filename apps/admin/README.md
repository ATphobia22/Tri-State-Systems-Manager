# UACF Admin

The initial admin service exposes a loopback-only health endpoint. Mutations intentionally return 503 until authentication, tenant-scoped authorization, CSRF protection, and immutable audit events are integrated. Do not expose this service publicly as an admin console yet.

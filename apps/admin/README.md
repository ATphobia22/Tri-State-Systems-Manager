# @tsm-uacf/admin

UACF platform administration surface (scaffold, v0.1.0).

**Status:** not wired. The server refuses to start unless `UACF_ADMIN_PORT` is
explicitly configured — fail-closed by design. No admin routes exist yet; this
package reserves the namespace and the startup contract for future operator
tooling (approvals review, provider health, audit browsing).

Human authority remains final: every administrative action requires an
explicit operator decision; nothing here acts autonomously.

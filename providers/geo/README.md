# @tsm/provider-geo

UACF provider stub — geo (v0.1.0).

**Status:** interface only. This is **not** a working geo integration:
no credentials are read, no network calls are made, and `execute()`
always throws fail-closed ("not configured").

To activate, an operator must explicitly configure credentials and endpoint
policy outside this stub; the stub itself never fabricates a connection.
Missing configuration stays unavailable — never fake data.

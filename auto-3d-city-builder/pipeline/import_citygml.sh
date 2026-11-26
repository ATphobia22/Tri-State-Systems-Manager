#!/usr/bin/env bash
# Retired unsafe import path. Review-only Roofer receipts cannot authorize import.
set -euo pipefail
printf '%s\n' 'BLOCKED: legacy CityGML import is disabled pending independent provenance, geometry and database acceptance.' >&2
exit 2

# Apple Shortcuts integration: read-only TSM snapshot

**Status:** documented integration recipe; user must create and test the shortcut on their Apple device. This repository change does not install a shortcut into iCloud or create a shareable iCloud shortcut link.

## Supported initial workflow

A user runs a shortcut manually to fetch the current TSM hydrology community snapshot. The documented endpoint is:

```http
GET https://tsm.tristate.org/api/hydrologic/community
Accept: application/json
```

Set the base URL to the actual deployed TSM API environment. The path is documented in TSM's real-time operations and deployment docs. Verify the endpoint is available and its JSON contract in the target environment before use.

## Create the shortcut on iPhone

1. Open **Shortcuts** and tap **+** to create a shortcut named `TSM — Hydrology Snapshot`.
2. Add **URL** and enter `https://tsm.tristate.org/api/hydrologic/community` (or your verified staging/API URL).
3. Add **Get Contents of URL**. Expand the action and set the method to **GET**.
4. Set the request to accept JSON if the action exposes that option. Do not add a request body.
5. Add **Quick Look** to inspect the returned JSON. Optionally add **Show Result** after confirming that the output is readable.
6. Run manually. Confirm the HTTP request succeeds and inspect source identity, observation time, retrieval time, qualifier, and freshness fields where returned.
7. If the endpoint returns an error or stale/unavailable result, preserve that state; do not transform it into a positive flood or safety conclusion.

Apple's guide demonstrates this same URL → Get Contents of URL pattern and explains GET/POST/PUT/PATCH/DELETE. TSM's initial recipe intentionally uses GET only.

## Safety and operations constraints

- **User-triggered only.** TSM's current hydrology policy prohibits background polling. Do not attach this request to a repeating timer or unattended automation.
- **Read-only only.** Do not use POST, PUT, PATCH, DELETE, retired ingestion routes, or alert-writing endpoints from this shortcut.
- **No privileged secrets in shared shortcuts.** Shortcuts can be shared. Never hard-code server credentials, provider API keys, or tokens into the shortcut.
- **OAuth caveat.** Apple's Shortcuts API guide documents that interactive OAuth 2 flows are not supported. If the target TSM deployment requires that flow, use an appropriately secured server-side integration; do not bypass authentication.
- **HTTPS only.** Never send sensitive data to an untrusted or non-TLS endpoint.
- **Rate limits and terms.** Respect TSM and upstream provider limits. Apple warns that API usage is subject to the service's terms and that repeated requests can cause overages.
- **No engineering authority from a shortcut.** A returned snapshot is contextual source data, not a surveyed value, official flood determination, or approved hydraulic design input. Preserve source timestamps, qualifiers, CRS, vertical datum, and freshness.
- **No direct Apple Compass import is implied.** This is a separate API request workflow. Waypoint entry/import remains governed by the waypoint schema and its review status.

## Configuration contract

The machine-readable integration reference is `integrations/apple-shortcuts/tsm-shortcuts-api.json`. It explicitly marks the integration as user-configured and documents constraints. It does not claim that a shortcut has been installed, that the endpoint is currently reachable, or that any iCloud share link exists.

## References

- [Apple: Request your first API in Shortcuts](https://support.apple.com/guide/shortcuts/request-your-first-api-apd58d46713f/ios)
- [Apple: API limitations in Shortcuts](https://support.apple.com/guide/shortcuts/api-limitations-apd891a6c84e/ios)
- [TSM: Real-Time Data Operations](../REAL-TIME-DATA-OPERATIONS.md)
- [TSM: Deployment and Operations](../DEPLOYMENT-AND-OPERATIONS.md)
- [Apple Support Communities search for API](https://discussions.apple.com/search?q=api&source=aml&origin=asc_serp)

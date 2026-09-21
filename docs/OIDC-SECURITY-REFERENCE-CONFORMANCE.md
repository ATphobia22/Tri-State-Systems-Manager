# OIDC Security Reference and Conformance Record

**Status:** implemented on `main`  
**Scope:** hosted TSM browser/API authentication boundary

## Standards reviewed

### OWASP

Reviewed the OWASP OAuth 2.0 and Session Management guidance.

Adopted:

- Authorization Code flow with PKCE.
- Transaction-bound `state`.
- OpenID Connect `nonce`.
- Exact redirect URI handling.
- No browser `localStorage`/`sessionStorage` token persistence.
- Secure, HttpOnly, SameSite session cookies.
- Explicit CSRF protection for cookie-authenticated state-changing requests.
- Exact-origin credentialed CORS.
- No arbitrary post-login redirect targets.

References:

- https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/

### OpenID Connect

Reviewed the OpenID Connect Core and Discovery specification family and current OpenID Foundation working-group material.

Adopted:

- Discovery metadata.
- Authorization Code flow.
- PKCE S256.
- ID-token validation with issuer, client audience, authorized-party and nonce checks.
- Access-token validation separately against the API audience.
- JWKS signature verification and key rotation refresh.
- Exact registered redirect URI.
- HTTPS enforcement outside local development.

References:

- https://openid.net/wg/connect/specifications/
- https://openid.net/specs/openid-connect-core-1_0-errata2.html
- https://openid.net/specs/openid-connect-discovery-1_0-errata2.html

### mod_auth_openidc

Repository reviewed:

https://github.com/ATphobia22/mod_auth_openidc

Useful patterns adopted conceptually:

- Discovery-driven provider configuration.
- Confidential client authentication.
- Explicit session cryptographic protection.
- RP/resource-server separation.
- Claim-based authorization.
- Awareness of FAPI 2.0, DPoP, mTLS and logout capabilities.

Not adopted:

- Apache dependency.
- Its server/session/cache implementation.
- Its configuration syntax.
- Its broader protocol surface merely for feature parity.

TSM remains a Node/React application and implements only the protocol controls needed by its threat model.

### lua-resty-openidc

Repository reviewed:

https://github.com/ATphobia22/lua-resty-openidc

Useful patterns adopted conceptually:

- Clear RP versus OAuth resource-server roles.
- Discovery and JWKS caching.
- Explicit token-endpoint client authentication.
- Configurable session-storage architecture.
- TLS verification as a mandatory production concern.

Not adopted:

- OpenResty/NGINX/Lua runtime dependencies.
- Lua session libraries.
- Lua-specific proxy configuration.

TSM's Node implementation provides the equivalent security boundary.

### AspNet.Security.OpenIdConnect.Server

Repository reviewed:

https://github.com/ATphobia22/AspNet.Security.OpenIdConnect.Server

Important finding:

The project is superseded by OpenIddict and is not an appropriate new runtime dependency for TSM.

Useful protocol concepts reviewed:

- Explicit endpoint matching.
- Request validation before token processing.
- Authorization/token/logout/revocation endpoint separation.
- HTTPS enforcement.
- Explicit claim destinations and authorization-ticket handling.

Not adopted:

- ASP.NET/OWIN/Katana dependencies.
- Password grant examples.
- Legacy server framework.

TSM intentionally does not implement a password grant.

## TSM implementation boundary

The production browser flow is:

```text
Browser
  |
  | GET /api/auth/login
  v
TSM OIDC BFF
  |
  | Authorization Code + PKCE S256 + state + nonce
  v
OpenID Provider
  |
  | authorization code
  v
TSM BFF
  |
  | confidential client_secret_basic token exchange
  v
OpenID Provider
  |
  | access_token + id_token
  v
TSM BFF
  |
  | validate ID token: signature/iss/aud/azp/nonce
  | validate access token: signature/iss/aud/exp/nbf/sub
  v
Encrypted HttpOnly Secure __Host-tsm_session
  |
  v
Browser
```

Provider credentials and OAuth tokens do not enter the Vite browser environment.

## Future high-assurance options

The reviewed OpenID ecosystem includes FAPI 2.0, DPoP, mTLS-bound tokens, PAR, logout specifications and OpenID AuthZEN authorization APIs. These are **not automatically required** for the current TSM deployment.

They should be enabled only when the deployment threat model and identity provider support justify them.

Potential future controls:

1. **FAPI 2.0** for deployments requiring a higher-assurance OAuth profile.
2. **DPoP** for sender-constrained tokens where bearer-token theft risk warrants it.
3. **mTLS** for controlled agency-to-agency machine integrations.
4. **PAR** when authorization-request confidentiality and pushed requests are required.
5. **Back-channel logout** when centralized enterprise logout/session revocation is required.
6. **AuthZEN Authorization API** when authorization policy must be delegated to a standards-based external PDP.

These should be introduced as separately tested capability gates rather than speculative dependencies.

## Security invariants

CI must continue to reject:

- public-client browser authentication in hosted mode;
- client secrets in Vite variables;
- browser token storage;
- missing PKCE;
- missing state/nonce binding;
- missing ID-token validation;
- insecure production redirect URIs;
- wildcard credentialed CORS;
- missing CSRF boundary;
- missing JWT signature/issuer/audience/expiry/subject validation;
- reviewer identity that differs from the authenticated subject.

## Deployment responsibility

The repository deliberately does not contain:

- a real agency identity-provider URL;
- client credentials;
- session secrets;
- production user assignments;
- private signing keys.

Those values belong in the deployment secret/configuration system and must be supplied by the responsible operator.

Software conformance does not constitute an ATO, regulatory certification, engineering seal, permit decision, or agency approval.

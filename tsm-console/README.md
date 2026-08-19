# TSM Console (Tri-State Systems Manager)

## Run

```bash
# Install
npm install

# SPA only (mock auth)
npm run dev

# Token proxy (OIDC production path)
npm run proxy
# or both:
npm run dev:all

# Production build
npm run build
npm run preview
```

## Environment

Copy `.env.example` → `.env`. For OIDC:

```
VITE_IDP_PROVIDER=oidc
VITE_IDP_AUTHORITY=https://...
VITE_IDP_CLIENT_ID=...
VITE_IDP_REDIRECT_URI=http://localhost:5173/login/callback
IDP_TOKEN_URL=https://.../oauth/token
IDP_CLIENT_SECRET=...
```

## Architecture highlights

- React Router v7 loaders + Zero-Trust auth gate
- Persistent Merkle Evidence Ledger
- Live NOAA/USGS stage
- 3D Digital Twin canvas (`/twin`) driven by site constants
- Backend token proxy (no secrets in browser)
- OpenMI 2.0 descriptor contracts + Daubert notes

Human authority remains final.

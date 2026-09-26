# npm ci peer dependency fix — 2026-09-25

## Root cause

`package.json` pinned `@react-three/fiber` to **9.8.1** (peers `react >=19 <19.4`) but **`package-lock.json` still resolved fiber **9.7.0** (peers `>=19 <19.3`).

With `react@19.3.0`, `npm ci` fails (ERESOLVE / Install dependencies from lockfile).

## Fix

Regenerate and commit **both**:

- `tsm-console/package.json` → `@react-three/fiber`: `9.8.1`
- `tsm-console/package-lock.json` → fiber **9.8.1**, root dep **9.8.1**, peer **`>=19 <19.4`**

Do not update only `package.json` without the lockfile.

## Verify

```bash
cd tsm-console
npm install -g npm@10.9.2
rm -rf node_modules
npm ci --no-audit --no-fund
```

// Asset module declarations required by TypeScript 7's stricter side-effect import checking.
declare module '*.css' {}

/** Vite client env bindings used by TSM browser plane. */
interface ImportMetaEnv {
  readonly VITE_TSM_API_BASE_URL?: string;
  /** Provenance-controlled Terrain-RGB XYZ template; fail-closed when unset/placeholder. */
  readonly VITE_TSM_TERRAIN_RGB_URL_TEMPLATE?: string;
  readonly VITE_TSM_MARTIN_BASE_URL?: string;
  readonly VITE_TSM_MARTIN_ROUTE_PREFIX?: string;
  readonly VITE_TSM_TERRAIN_RGB_MAXZOOM?: string;
  readonly VITE_KEYCLOAK_URL?: string;
  readonly VITE_IDP_AUTHORITY?: string;
  readonly DEV: boolean;
  readonly MODE: string;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

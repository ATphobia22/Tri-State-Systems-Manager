import { defineConfig, loadEnv, type IndexHtmlTransformResult } from 'vite';
import react from '@vitejs/plugin-react';

const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === 'true';
const githubRepository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const githubPagesBasePath = process.env.VITE_PAGES_BASE_PATH?.trim()
  || (githubRepository ? `/${githubRepository}/` : '/');

function cspPlugin() {
  return {
    name: 'tsm-csp',
    transformIndexHtml(_html: string): IndexHtmlTransformResult {
      const keycloakUrl = process.env.VITE_KEYCLOAK_URL || process.env.VITE_IDP_AUTHORITY || '';
      let keycloakOrigin = '';
      try { keycloakOrigin = keycloakUrl ? new URL(keycloakUrl).origin : ''; } catch { throw new Error('VITE_KEYCLOAK_URL/VITE_IDP_AUTHORITY must be an absolute URL'); }
      const connect = [
        "'self'",
        'https://api.waterdata.usgs.gov',
        'https://water.noaa.gov',
        'https://api.water.noaa.gov',
        'https://elevation.nationalmap.gov',
        'https://di-ingov.img.arcgis.com',
        'https://gisdata.in.gov',
        'https://hazards.fema.gov',
        'https://*.arcgis.com',
        'https://*.openstreetmap.org',
        'wss:',
        keycloakOrigin,
      ].filter(Boolean).join(' ');
      const policy = [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "script-src 'self' 'wasm-unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "worker-src 'self' blob:",
        "connect-src " + connect,
        "manifest-src 'self'",
        "media-src 'self' blob:",
        "frame-src 'self'",
        "form-action 'self'",
      ].join('; ');
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }];
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), 'VITE_'));
  return {
    base: isGitHubPagesBuild ? githubPagesBasePath : '/',
    plugins: [react(), cspPlugin()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:8787',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'three-vendor',
                test: /[\\/]node_modules[\\/](?:three|@react-three)[\\/]/,
              },
              {
                name: 'maplibre-vendor',
                test: /[\\/]node_modules[\\/]maplibre-gl[\\/]/,
              },
              {
                name: 'geospatial-vendor',
                test: /[\\/]node_modules[\\/]geotiff[\\/]/,
              },
            ],
          },
        },
      },
    },
  };
});

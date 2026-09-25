import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.tristate.tsm.ios',
  appName: 'Tri-State Systems',
  webDir: 'dist',
  backgroundColor: '#0A0F1A',
  ios: {
    // WKWebView content inset behavior; safe-area handled in CSS via env()
    contentInset: 'always',
    // Allow the bundled file:// web app to reach the same HTTPS APIs the
    // desktop/PWA build uses (USGS, NOAA, tile servers, TSM Node API).
    // The app's own CSP meta tag still governs what may load.
    allowsLinkPreview: false,
  },
  server: {
    // No live-reload server in production builds; dist/ is bundled.
    androidScheme: 'https',
  },
};

export default config;

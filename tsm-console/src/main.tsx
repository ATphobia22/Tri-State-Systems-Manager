import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { getRouter } from './lib/router';
import { installRuntimePerformanceTelemetry } from './lib/runtime-performance';
// Preload MapLibre styles in the entry bundle before any lazy Atlas map route mounts.
// A route-only CSS preload can fail during Pages deployment/cache propagation.
import 'maplibre-gl/dist/maplibre-gl.css';
// Pages Atlas is a lazy route, but its stylesheet must be in the eager entry CSS.
// Otherwise Vite injects a route-time preload that can reject after CDN/cache changes.
import './routes/TriStateAtlasView.css';
import './styles/shadcn-primitives.css';
import './styles/tsm-design-system.css';

const router = getRouter();
installRuntimePerformanceTelemetry(router);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);

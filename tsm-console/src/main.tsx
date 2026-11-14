import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { getRouter } from './lib/router';
import { installRuntimePerformanceTelemetry } from './lib/runtime-performance';
// Preload MapLibre styles in the entry bundle before any lazy Atlas map route mounts.
// A route-only CSS preload can fail during Pages deployment/cache propagation.
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles/shadcn-primitives.css';
import './styles/tsm-design-system.css';

const router = getRouter();
installRuntimePerformanceTelemetry(router);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);

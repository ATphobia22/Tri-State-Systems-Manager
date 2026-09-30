import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { getRouter } from './lib/router';
import { installRuntimePerformanceTelemetry } from './lib/runtime-performance';

const router = getRouter();
installRuntimePerformanceTelemetry(router);

document.getElementById('boot-fallback')?.remove();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);

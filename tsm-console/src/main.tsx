import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './lib/router';
import { installRuntimePerformanceTelemetry } from './lib/runtime-performance';

installRuntimePerformanceTelemetry(router);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);

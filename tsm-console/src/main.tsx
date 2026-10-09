import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { getRouter } from './lib/router';
import { installRuntimePerformanceTelemetry } from './lib/runtime-performance';
import './styles/shadcn-primitives.css';
import './styles/tsm-design-system.css';

const router = getRouter();
installRuntimePerformanceTelemetry(router);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);

/** Per-route document.title. Rendered inside RootLayout; watches location so no router changes are needed. */

import { useEffect } from 'react';
import { useLocation } from 'react-router';

const SITE = 'Tri-State Systems Manager';

/**
 * Phase 2: the four twin surfaces have distinct titles matching their purposes
 * (see ROUTE MAP in lib/router.tsx):
 *   /map            → Hydraulic Map  (2D map + visualization controls)
 *   /twin           → Twin Canvas    (full-bleed canvas, minimal chrome)
 *   /digital-twin   → Twin Summary   (card dashboard, deep link)
 *   /digital-twin-v2→ Digital Twin 3D (immersive open-world app, lazy)
 */
const ROUTE_TITLES: Record<string, string> = {
  '/': 'Charter',
  '/architecture': 'Trust Planes',
  '/data-fabric': 'Public Data Fabric',
  '/river-watch': 'River Watch',
  '/engineering-section': 'Engineering Section',
  '/needs': 'Human Needs',
  '/ledger': 'Evidence Ledger',
  '/lineage': 'Data Contracts',
  '/benefit': 'Benefit Engine',
  '/map': 'Hydraulic Map',
  '/eoc': 'EOC Surface',
  '/twin': 'Twin Canvas',
  '/digital-twin': 'Twin Summary',
  '/digital-twin-v2': 'Digital Twin 3D',
  '/flood-sim': 'Flood Simulator',
  '/login': 'Sign in',
  '/login/callback': 'Sign in',
};

export function RouteTitle(): null {
  const { pathname } = useLocation();
  useEffect(() => {
    const label = ROUTE_TITLES[pathname] ?? SITE;
    document.title = `${label} — ${SITE}`;
  }, [pathname]);
  return null;
}

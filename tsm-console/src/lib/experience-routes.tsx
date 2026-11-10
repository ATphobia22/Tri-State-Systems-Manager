/** Lazy route entries for cinematic engineering + signature experiences + workspace shell. */
import type { RouteObject } from 'react-router';
import { t } from './design-tokens';

function RouteLoadingFallback({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" style={{ padding: '2rem', color: t.color.text.secondary, background: t.color.surface.base, minHeight: '40vh', fontSize: t.font.size.base }}>
      Loading {label}…
    </div>
  );
}

/** Spread into appRoutes children after cinematic route. */
export const experienceChildRoutes: RouteObject[] = [
  {
    path: 'cinematic-engineering',
    hydrateFallbackElement: <RouteLoadingFallback label="the cinematic engineering experience" />,
    lazy: async () => ({ Component: (await import('../routes/CinematicEngineeringExperienceView')).default }),
  },
  {
    path: 'workspaces',
    hydrateFallbackElement: <RouteLoadingFallback label="workspace shell" />,
    lazy: async () => ({ Component: (await import('../workspaces/WorkspaceShell')).default }),
  },
  {
    path: 'experience/living-river',
    hydrateFallbackElement: <RouteLoadingFallback label="Living River Valley" />,
    lazy: async () => ({ Component: (await import('../experiences/LivingRiverValleyView')).default }),
  },
  {
    path: 'experience/scenario-sandbox',
    hydrateFallbackElement: <RouteLoadingFallback label="scenario sandbox" />,
    lazy: async () => ({ Component: (await import('../experiences/EngineeringScenarioSandboxView')).default }),
  },
  {
    path: 'experience/evidence-storyboard',
    hydrateFallbackElement: <RouteLoadingFallback label="evidence storyboard" />,
    lazy: async () => ({ Component: (await import('../experiences/EvidenceCinemaStoryboardView')).default }),
  },
];

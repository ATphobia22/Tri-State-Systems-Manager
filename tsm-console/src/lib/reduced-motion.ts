/**
 * Shared `prefers-reduced-motion` gate.
 *
 * Centralizes the media-query read so every RAF / cinematic animation path
 * honors the user's OS accessibility setting the same way. Safe to call
 * during SSR / tests (returns false when `window.matchMedia` is unavailable).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

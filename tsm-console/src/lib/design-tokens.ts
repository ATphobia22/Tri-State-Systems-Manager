/**
 * Design tokens — the single visual-system source of truth for the TSM console.
 *
 * Phase 2 consolidation: ~78 hardcoded hexes across the console collapse to the
 * ~20 semantic tokens below (11 near-black background variants collapse to
 * `surface.deep`). This module systematizes the existing dark aesthetic — it
 * does not redesign it. All token values are the colors the app already ships;
 * only the near-black duplicates and the failing Phase 0 grays were normalized.
 *
 * PHASE 0 CONTRAST CONTRACT — these exact values MUST NOT change without a
 * re-measured WCAG 2.1 AA check (they fixed the four measured failures):
 *   - `action.primary`      #0277b8  (governance "Sign & append" button; was #0284c7 → 4.10:1)
 *   - `badge.unknown`       #a3a3a3  (UNKNOWN chip; was #000 on #555 → 2.82:1)
 *   - `text.secondary`      #94a3b8  (secondary text on #0f172a/#1e293b; replaces
 *                                     #64748b → 3.75:1 and #475569 → 2.36:1)
 *
 * Migration map (old hex → token), applied to the shell + highest-traffic views:
 *   #020617 (+10 near-black variants: #0b1220 #0c1016 #0d1219 #0b0e12 #07111c
 *    #0f1b27 #06101a #11151b #0b1724 #12233a #111827)        → surface.deep
 *   #0f172a                                                  → surface.base
 *   #1e293b                                                  → surface.card / border.subtle
 *   #1f2937                                                  → border.subtle
 *   #334155                                                  → border.default
 *   #f8fafc                                                  → text.primary
 *   #e2e8f0                                                  → text.body
 *   #cbd5e1                                                  → text.muted
 *   #94a3b8                                                  → text.secondary
 *   #64748b  (old, failing)                                  → text.secondary
 *   #475569  (old, failing)                                  → text.secondary
 *   #38bdf8                                                  → accent.brand
 *   #0ea5e9                                                  → accent.brandDark
 *   #22d3ee                                                  → accent.cyan
 *   #7dd3fc                                                  → status.info
 *   #34d399 / #4ade80                                        → status.success / status.successBright
 *   #fbbf24 / #fde047                                        → status.warning / status.warningBright
 *   #f87171 / #fb7185 / #fb923c / #fca5a5                    → status.danger / .dangerLight / .orange / .dangerSoft
 *   #a78bfa                                                  → status.violet
 *   #0277b8                                                  → action.primary
 *   #a3a3a3                                                  → badge.unknown
 *   #ffffff / #fff                                           → text.inverse
 *
 * Usage: one mechanism everywhere — a typed const object consumed directly in
 * `style={{}}` props (and interpolated into the shell `<style>` block). No CSS
 * variables, no className system, so the migration stays a pure value swap with
 * no new runtime behavior.
 */

export const designTokens = {
  color: {
    surface: {
      /** App/page background. */
      base: '#0f172a',
      /** Cards, panels, wells. */
      card: '#1e293b',
      /** Near-black: header, sidebar, map chrome. Collapses 11 near-black variants. */
      deep: '#020617',
      /** Deep info-ink surface (tour hint strip). */
      infoInk: '#082f49',
      /** Deep warning-ink surface (governance caution note). */
      warningInk: '#17130a',
      /** Deep danger-ink surface (error alert box). */
      dangerInk: '#450a0a',
      /** Deep success-ink surface (completion confirmation). */
      successInk: '#052e16',
    },
    text: {
      /** Headings on dark surfaces. */
      primary: '#f8fafc',
      /** Default body text. */
      body: '#e2e8f0',
      /** Muted detail text. */
      muted: '#cbd5e1',
      /** Secondary text — Phase 0 value; replaces failing #64748b/#475569. */
      secondary: '#94a3b8',
      /** Text on filled accent/action backgrounds. */
      inverse: '#ffffff',
      /** Dark text on light chips. */
      onLight: '#0f172a',
    },
    border: {
      /** Hairline separators on dark surfaces. */
      subtle: '#1e293b',
      /** Default control/panel borders. */
      default: '#334155',
      /** Warning-ink border (governance caution note). */
      warningInk: '#7c5e10',
    },
    accent: {
      /** Primary brand accent (links, active nav, key values). */
      brand: '#38bdf8',
      brandDark: '#0ea5e9',
      cyan: '#22d3ee',
      /** Translucent brand tints for chips/buttons on dark surfaces. */
      brandSoft: 'rgba(56,189,248,0.15)',
      brandBorder: 'rgba(56,189,248,0.5)',
      brandHairline: 'rgba(56,189,248,0.35)',
      cyanSoft: 'rgba(34,211,238,0.12)',
    },
    status: {
      success: '#34d399',
      successBright: '#4ade80',
      successSoft: '#86efac',
      successBorder: '#16a34a',
      warning: '#fbbf24',
      warningBright: '#fde047',
      danger: '#f87171',
      dangerLight: '#fb7185',
      dangerSoft: '#fca5a5',
      dangerPale: '#fecaca',
      orange: '#fb923c',
      info: '#7dd3fc',
      violet: '#a78bfa',
    },
    action: {
      /** Governance button — Phase 0 exact value, do not change. */
      primary: '#0277b8',
      /** Disabled control fill. */
      disabled: '#334155',
    },
    badge: {
      /** UNKNOWN chip — Phase 0 exact value, do not change. */
      unknown: '#a3a3a3',
    },
  },
  radius: {
    xs: 6,
    sm: 8,
    md: 10,
    lg: 12,
    xl: 14,
    xxl: 16,
    pill: 999,
  },
  spacing: {
    xs: '0.35rem',
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.25rem',
    xxl: '1.5rem',
    xxxl: '2rem',
  },
  font: {
    family: {
      ui: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    },
    size: {
      xxs: '0.6rem',
      xs: '0.65rem',
      sm: '0.7rem',
      md: '0.75rem',
      base: '0.8rem',
      lg: '0.85rem',
      xl: '0.9rem',
      h3: '1rem',
      h2: '1.15rem',
      h1: '1.4rem',
      display: '1.65rem',
    },
    weight: {
      regular: 400,
      medium: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.2,
      base: 1.45,
      relaxed: 1.6,
    },
  },
  shadow: {
    /** Card lift on dark surfaces. */
    card: '0 8px 24px rgba(0,0,0,0.35)',
  },
} as const;

export type DesignTokens = typeof designTokens;

/** Short alias used across migrated components: `t.color.surface.card`, … */
export const t = designTokens;

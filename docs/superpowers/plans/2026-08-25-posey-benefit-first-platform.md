# Posey County Benefit-First Resilience Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate a benefit-first Posey County resilience dashboard into the existing Tri-State Systems Manager digital-twin route, with provenance-controlled evidence, public-interest grant intelligence, human-authority safeguards, and actionable community priorities.

**Architecture:** Extend the existing React Router/TypeScript console instead of creating a parallel app. Add a typed Posey evidence registry and a route-level dashboard that separates verified government observations, program intelligence, project proposals, and unverified legacy claims. Preserve the existing Digital Twin shell and human-authority model.

**Tech Stack:** React 19, TypeScript 5.6, React Router 7, existing Vite console, existing Vitest/Node tests.

**Spec:** `docs/superpowers/plans/2026-08-25-posey-benefit-first-platform.md`

## Global Constraints

- Do not promote unverified engineering constants to regulatory facts.
- Keep FEMA effective mapping, Indiana DNR Best Available mapping, USGS observations, and project-generated calculations as distinct evidence classes.
- Human authority remains final for regulatory, funding, property, health, and safety decisions.
- No PII/PHI is displayed by the public-benefit dashboard.
- Grant deadlines and funding requirements are labeled as time-sensitive and must link to issuing agencies.
- Existing TSM routes and Digital Twin functionality remain available.
- TypeScript remains strict; do not introduce `any`.

---

### Task 1: Posey evidence registry

**Files:**
- Create: `tsm-console/src/data/poseyEvidence.ts`
- Test: `tsm-console/tests/posey-evidence.test.ts`

**Interfaces:**
- Produces typed `PoseyEvidenceRecord`, `PoseyGrantRecord`, `PoseyPriority`, and immutable arrays consumed by the dashboard.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { POSEY_EVIDENCE, POSEY_GRANTS, POSEY_PRIORITIES } from '../src/data/poseyEvidence';

describe('Posey evidence registry', () => {
  it('contains official government sources only in verified records', () => {
    const verified = POSEY_EVIDENCE.filter((record) => record.status === 'verified');
    expect(verified.length).toBeGreaterThan(0);
    expect(verified.every((record) => record.authorityLevel === 'government')).toBe(true);
  });

  it('keeps legacy claims out of verified regulatory evidence', () => {
    const legacy = POSEY_EVIDENCE.filter((record) => record.status === 'legacy_unverified');
    expect(legacy.some((record) => record.claim.includes('375.0'))).toBe(true);
    expect(legacy.some((record) => record.claim.includes('368.7'))).toBe(true);
  });

  it('contains benefit priorities with measurable outcomes', () => {
    expect(POSEY_PRIORITIES.length).toBeGreaterThanOrEqual(5);
    expect(POSEY_PRIORITIES.every((p) => p.outcomes.length >= 2)).toBe(true);
  });

  it('marks closed funding opportunities as closed', () => {
    const closed = POSEY_GRANTS.filter((grant) => grant.status === 'closed');
    expect(closed.every((grant) => grant.deadline)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tsm-console && npm test -- --run tests/posey-evidence.test.ts`
Expected: FAIL because the registry module does not yet exist.

- [ ] **Step 3: Implement typed registry**

Create government-source records for Indiana DNR INFIP/Best Available, USGS 03378500, USGS SIR 2016-5119, FEMA MSC, INDOT CCMG, IDEM §319, OCRA CDBG, USDA NRCS EWP, USDA Rural Development, and USACE CAP §205. Add legacy-unverified records for conflicting project constants without treating either as regulatory truth.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tsm-console && npm test -- --run tests/posey-evidence.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/poseyEvidence.ts tests/posey-evidence.test.ts
git commit -m "feat: add Posey evidence and benefit registry"
```

---

### Task 2: Benefit-first Posey dashboard

**Files:**
- Create: `tsm-console/src/routes/PoseyResilienceDashboard.tsx`
- Modify: `tsm-console/src/routes/TwinCanvasView.tsx`
- Test: `tsm-console/tests/posey-dashboard.test.tsx`

**Interfaces:**
- Consumes `POSEY_EVIDENCE`, `POSEY_GRANTS`, and `POSEY_PRIORITIES`.
- Produces an accessible dashboard with evidence status, community priorities, funding pathways, and human-authority warnings.

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen } from '@testing-library/react';
import PoseyResilienceDashboard from '../src/routes/PoseyResilienceDashboard';

test('renders benefit-first Posey sections', () => {
  render(<PoseyResilienceDashboard />);
  expect(screen.getByRole('heading', { name: /Posey County Resilience/i })).toBeTruthy();
  expect(screen.getByText(/Human authority remains final/i)).toBeTruthy();
  expect(screen.getByText(/Evidence integrity/i)).toBeTruthy();
  expect(screen.getByText(/Funding pathways/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tsm-console && npm test -- --run tests/posey-dashboard.test.tsx`
Expected: FAIL because the component does not yet exist.

- [ ] **Step 3: Implement dashboard**

Build responsive cards for: evidence integrity, current hydrology source, human needs, infrastructure/resilience, funding pathways, and next actions. Each evidence item displays status and official-source link. Legacy/unverified values display a warning rather than a decision.

- [ ] **Step 4: Replace Digital Twin route entry**

Update `TwinCanvasView.tsx` to render the Posey dashboard above the existing cinematic HUD, preserving the current digital-twin visualization as a child section.

- [ ] **Step 5: Run test and type check**

Run: `cd tsm-console && npm test -- --run tests/posey-dashboard.test.tsx && npm run check:type`
Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/routes/PoseyResilienceDashboard.tsx src/routes/TwinCanvasView.tsx tests/posey-dashboard.test.tsx
git commit -m "feat: add benefit-first Posey resilience dashboard"
```

---

### Task 3: Verification and integration gate

**Files:**
- Modify: `tsm-console/src/components/RootLayout.tsx` only if required for navigation/accessibility labels.
- Test: existing console test suite.

**Interfaces:**
- Consumes the completed dashboard and registry.
- Produces a buildable console with no regression to existing routes.

- [ ] **Step 1: Run parse/type checks**

Run: `cd tsm-console && npm run check`
Expected: PASS.

- [ ] **Step 2: Run full tests**

Run: `cd tsm-console && npm test`
Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `cd tsm-console && npm run build`
Expected: PASS and Vite produces a production bundle.

- [ ] **Step 4: Review for evidence-status leakage**

Search the dashboard and registry for `verified` records and confirm every such record has an official government authority and source URL. Confirm legacy claims remain `legacy_unverified`.

- [ ] **Step 5: Commit verification documentation**

```bash
git add docs/superpowers/plans/2026-08-25-posey-benefit-first-platform.md
git commit -m "chore: verify Posey benefit-first integration"
```

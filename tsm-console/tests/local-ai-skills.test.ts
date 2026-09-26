/**
 * Tests for local-ai skill packs + router + copilot wiring.
 * - Registry loads every pack file on disk; packs are schema-valid.
 * - Router selects the correct domain(s) for sample queries across all
 *   13 fields; deterministic (fixed tie-break, no randomness).
 * - Every pack embeds the governing axiom and carries its disclaimers.
 * - Assembled prompts include provenance labels and repo-grounded facts.
 * - Site constants in packs cross-check against the canonical source
 *   (scientific-analytics.ts); any mismatch fails.
 * - Legal routing forces the legal disclaimer into the user prompt.
 * - Zero fetch calls on the copilot path (packs are bundled static data).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  listSkillPacks,
  getSkillPack,
  routeQuery,
  buildSkillContext,
  legalPackId,
  GOVERNING_AXIOM,
  PROVISIONAL_LABEL,
  askCopilot,
} from "../src/lib/local-ai/index";
import {
  BONEBANK_SITE_CONSTANTS,
  BONEBANK_GEOCODED_LAT,
  BONEBANK_GEOCODED_LNG,
  scientificSiteSnapshot,
} from "../src/lib/scientific-analytics";

const packModules = import.meta.glob<{ default: unknown }>(
  "../src/lib/local-ai/skills/*.json",
  { eager: true },
);

function routedIds(query: string): string[] {
  return routeQuery(query).map((p) => p.id);
}

function selfScope(): Record<string, unknown> {
  return globalThis as unknown as Record<string, unknown>;
}

function setSelf() {
  selfScope()["self"] = globalThis;
}

function clearGlobals() {
  for (const name of ["LanguageModel", "Summarizer", "Proofreader"]) {
    delete (globalThis as Record<string, unknown>)[name];
    const s = selfScope()["self"] as Record<string, unknown> | undefined;
    if (s) delete s[name];
  }
}

interface CapturedCreate {
  systemPrompt?: unknown;
  [key: string]: unknown;
}

function mockAvailableModel(captured: { create?: CapturedCreate; input?: string }) {
  const scope = selfScope()["self"] as Record<string, unknown>;
  scope["LanguageModel"] = {
    availability: async () => "available",
    create: async (options: CapturedCreate) => {
      captured.create = options;
      return {
        prompt: async (input: string) => {
          captured.input = input;
          return "mock model answer";
        },
        destroy: () => {},
      };
    },
  };
}

describe("skill pack registry", () => {
  it("loads every pack file on disk exactly once", () => {
    const files = Object.keys(packModules);
    expect(files.length).toBe(13);
    const packs = listSkillPacks();
    expect(packs.length).toBe(13);
    const ids = packs.map((p) => p.id).sort();
    expect(new Set(ids).size).toBe(13);
    for (const file of files) {
      const base = file.split("/").pop()!.replace(/\.json$/, "");
      expect(ids).toContain(base);
    }
  });

  it("every pack is schema-valid and axiom-bearing", () => {
    for (const pack of listSkillPacks()) {
      expect(pack.id).toMatch(/^[a-z-]+$/);
      expect(pack.domain.length).toBeGreaterThan(0);
      expect(pack.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(pack.sources.length).toBeGreaterThan(0);
      expect(pack.expert_role.length).toBeGreaterThan(0);
      // Governing axiom verbatim + provisional-output requirement in preamble.
      expect(pack.preamble).toContain(GOVERNING_AXIOM);
      expect(pack.preamble).toContain(
        "AI-generated output is provisional, human review required",
      );
      expect(pack.preamble).toContain("model-general");
      expect(pack.repo_grounded_facts.length).toBeGreaterThan(0);
      for (const fact of pack.repo_grounded_facts) {
        expect(fact.statement.length).toBeGreaterThan(0);
        expect(fact.source.length).toBeGreaterThan(0);
        expect(fact.provenance.length).toBeGreaterThan(0);
      }
      expect(pack.hard_rules.length).toBeGreaterThan(0);
      // The pack's own disclaimer strings are present and non-empty.
      expect(pack.disclaimers.length).toBeGreaterThan(0);
      for (const disclaimer of pack.disclaimers) {
        expect(disclaimer.length).toBeGreaterThan(0);
      }
      expect(pack.keywords.length).toBeGreaterThan(0);
      expect(pack.not_built.length).toBeGreaterThan(0);
    }
  });

  it("legal pack forces the legal disclaimer on every legal output", () => {
    const legal = getSkillPack(legalPackId());
    expect(legal).toBeDefined();
    const disclaimer =
      "This is legal information only, not legal advice — consult licensed counsel.";
    expect(legal!.disclaimers).toContain(disclaimer);
    expect(legal!.preamble).toContain("LEGAL INFORMATION ONLY");
    expect(legal!.preamble).toContain(disclaimer);
  });
});

describe("skill pack router", () => {
  const cases: Array<[string, string]> = [
    ["What Manning's n should I use for the diffusion-wave stability check?", "engineering"],
    ["What is the SCS curve number runoff equation?", "hydrology"],
    ["How do I fix this TypeScript build error in vitest?", "coding"],
    ["How should the panel layout show the provisional label?", "design"],
    ["Which EPSG code should I use for Illinois data?", "mapping"],
    ["What does the SSURGO soils layer tell us?", "geology"],
    ["Is there an NWS flood forecast for the Wabash?", "meteorology"],
    ["What did the FEMA letter request for the LOMA?", "legal"],
    ["What uncertainty should I report with the freeboard margin?", "science"],
    ["Check my freeboard arithmetic and show the calculation", "mathematics"],
    ["Do we have borehole data for the berm embankment?", "geotechnical"],
    ["List the evidence pipeline stages in order", "regulatory"],
    ["Which grants could fund the berm project?", "grants"],
  ];

  for (const [query, expected] of cases) {
    it(`routes "${query.slice(0, 48)}…" to ${expected} first`, () => {
      expect(routedIds(query)[0]).toBe(expected);
    });
  }

  it("routes 'is this crest plausible?' to hydrology + mathematics", () => {
    const ids = routedIds("is this crest plausible?");
    expect(ids).toContain("hydrology");
    expect(ids).toContain("mathematics");
    expect(ids.slice(0, 2)).toEqual(["hydrology", "mathematics"]);
  });

  it("routes 'help me draft the LOMA response' to legal + engineering", () => {
    const ids = routedIds("help me draft the LOMA response");
    expect(ids).toContain("legal");
    expect(ids).toContain("engineering");
  });

  it("is deterministic: same query, same order, no randomness", () => {
    const queries = [
      "is this crest plausible?",
      "help me draft the LOMA response",
      "Which EPSG code should I use for Illinois data?",
      "random words with no domain match at all xyzzy",
    ];
    for (const q of queries) {
      expect(routedIds(q)).toEqual(routedIds(q));
    }
  });

  it("falls back to the science pack when no keyword matches", () => {
    expect(routedIds("random words with no domain match at all xyzzy")).toEqual([
      "science",
    ]);
  });

  it("caps routed packs at three", () => {
    const ids = routedIds("loma engineering hydrology mapping legal grants flood");
    expect(ids.length).toBeLessThanOrEqual(3);
  });
});

describe("prompt assembly", () => {
  it("buildSkillContext includes provenance labels and repo sources", () => {
    const context = buildSkillContext(routeQuery("is this crest plausible?"));
    expect(context).toContain(GOVERNING_AXIOM);
    expect(context).toContain("MODELED");
    expect(context).toContain("tsm-console/src/lib/hydrology-runoff.ts");
    expect(context).toContain("repo-grounded");
  });

  it("assembled prompts carry the axiom via askCopilot (mocked model)", async () => {
    setSelf();
    clearGlobals();
    const captured: { create?: CapturedCreate; input?: string } = {};
    mockAvailableModel(captured);
    const result = await askCopilot("is this crest plausible?");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.label).toBe(PROVISIONAL_LABEL);
      expect(result.provenance).toBe("model-generated");
    }
    expect(String(captured.create?.systemPrompt)).toContain(GOVERNING_AXIOM);
    expect(String(captured.create?.systemPrompt)).toContain("MODELED");
    clearGlobals();
  });

  it("legal routing forces the disclaimer into the user prompt", async () => {
    setSelf();
    clearGlobals();
    const captured: { create?: CapturedCreate; input?: string } = {};
    mockAvailableModel(captured);
    const result = await askCopilot("help me draft the LOMA response");
    expect(result.ok).toBe(true);
    expect(captured.input).toContain(
      "This is legal information only, not legal advice — consult licensed counsel.",
    );
    expect(String(captured.create?.systemPrompt)).toContain("LEGAL INFORMATION ONLY");
    clearGlobals();
  });

  it("askCopilot passes simulator context numbers through without recompute", async () => {
    setSelf();
    clearGlobals();
    const captured: { create?: CapturedCreate; input?: string } = {};
    mockAvailableModel(captured);
    await askCopilot("explain this", {
      scenarioSummary: {
        scenarioName: "100-year overbank",
        peakDepthFt: 2.5,
        keyFindings: ["2 structures affected"],
      },
    });
    expect(captured.input).toContain("100-year overbank");
    expect(captured.input).toContain("2.5 ft");
    clearGlobals();
  });
});

describe("site constants cross-check (canonical: scientific-analytics.ts)", () => {
  const packs = listSkillPacks();
  const allText = JSON.stringify(packs);

  it("numeric site constants always appear with their correct labels", () => {
    const pairs: Array<[string, string]> = [
      [String(BONEBANK_SITE_CONSTANTS.BFE), "BFE"],
      [String(BONEBANK_SITE_CONSTANTS.LAG), "LAG"],
      [String(BONEBANK_SITE_CONSTANTS.FFE), "FFE"],
      [String(BONEBANK_SITE_CONSTANTS.BERM), "BERM"],
    ];
    for (const pack of packs) {
      for (const fact of pack.repo_grounded_facts) {
        for (const [num, label] of pairs) {
          if (fact.statement.includes(num)) {
            expect(
              fact.statement.toLowerCase(),
              `${pack.id}: "${num}" must be labeled ${label} (source: ${fact.source})`,
            ).toContain(label.toLowerCase());
          }
        }
      }
    }
  });

  it("freeboard margins in packs match scientificSiteSnapshot()", () => {
    const snap = scientificSiteSnapshot();
    expect(allText).toContain(`+${snap.freeboardMargins.lagFreeboard} ft`);
    expect(allText).toContain(`+${snap.freeboardMargins.ffeFreeboard} ft`);
    expect(allText).toContain(`+${snap.freeboardMargins.bermFreeboard} ft`);
  });

  it("coordinates match the canonical geocoded address point", () => {
    expect(BONEBANK_GEOCODED_LAT).toBe(37.84589);
    expect(BONEBANK_GEOCODED_LNG).toBe(-88.0051);
    expect(allText).toContain("37.84589");
    expect(allText).toContain("-88.0051");
  });

  it("state CRS codes appear in the mapping pack", () => {
    const mapping = getSkillPack("mapping")!;
    const text = JSON.stringify(mapping);
    expect(text).toContain("EPSG:2966");
    expect(text).toContain("EPSG:3435");
    expect(text).toContain("EPSG:3088");
  });
});

describe("zero-fetch property", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    setSelf();
    clearGlobals();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    clearGlobals();
    fetchSpy?.mockRestore();
  });

  it("routing and prompt assembly make zero fetch calls", () => {
    routeQuery("is this crest plausible?");
    buildSkillContext(routeQuery("help me draft the LOMA response"));
    listSkillPacks();
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it("askCopilot fail-closed path makes zero fetch calls", async () => {
    const result = await askCopilot("help me draft the LOMA response");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe("unavailable");
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it("askCopilot empty question makes zero fetch calls", async () => {
    const result = await askCopilot("   ");
    expect(result.ok).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });
});

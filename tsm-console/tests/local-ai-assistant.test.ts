/**
 * Tests for local-ai/assistant.
 * - Prompt construction asserts the governing axiom is embedded in every
 *   system prompt.
 * - Graceful fail-closed paths return { status: 'unavailable', reason }.
 * - Successful results carry full provenance + provisional status + label.
 * - Zero fetch calls on the entire local-AI path (no server fallback).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  explainFloodResult,
  askFloodplainQuestion,
  summarizeEvidencePacket,
  proofreadFiling,
  GOVERNING_AXIOM,
  PROVISIONAL_LABEL,
  AI_MODEL_NAME,
} from "../src/lib/local-ai/assistant";

const AXIOM_SNIPPET = "Technology informs people; it does not silently govern people";

function selfScope(): Record<string, unknown> {
  return globalThis as unknown as Record<string, unknown>;
}

function setSelf() {
  selfScope()["self"] = globalThis;
}

function clearGlobals() {
  for (const name of ["LanguageModel", "Summarizer", "Proofreader"]) {
    delete selfScope()["self"]?.[name as keyof object];
    delete selfScope()[name];
    delete (globalThis as Record<string, unknown>)[name];
  }
  const s = selfScope()["self"] as Record<string, unknown> | undefined;
  if (s) for (const name of ["LanguageModel", "Summarizer", "Proofreader"]) delete s[name];
}

describe("local-ai assistant", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    setSelf();
    clearGlobals();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    clearGlobals();
    fetchSpy?.mockRestore();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("embeds the governing axiom in the system prompt for explainFloodResult", async () => {
    let capturedSystemPrompt: unknown;
    const prompt = vi.fn(async () => "Plain-language explanation.");
    (selfScope()["self"] as Record<string, unknown>)["LanguageModel"] = {
      availability: async () => "available",
      create: vi.fn(async (opts: { systemPrompt?: string }) => {
        capturedSystemPrompt = opts.systemPrompt;
        return { prompt, destroy: vi.fn() };
      }),
    };

    const result = await explainFloodResult({
      scenarioName: "100-year overbank",
      peakDepthFt: 4.2,
      keyFindings: ["Depth exceeds 4 ft near the Bonebank Rd culvert."],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe("Plain-language explanation.");
      expect(result.model).toBe(AI_MODEL_NAME);
      expect(result.provenance).toBe("model-generated");
      expect(result.status).toBe("provisional");
      expect(result.humanReviewRequired).toBe(true);
      expect(result.label).toBe(PROVISIONAL_LABEL);
    }
    expect(String(capturedSystemPrompt)).toContain(AXIOM_SNIPPET);
    expect(String(capturedSystemPrompt)).toContain(GOVERNING_AXIOM);
  });

  it("embeds the axiom in askFloodplainQuestion and passes the question through", async () => {
    let capturedSystemPrompt: unknown;
    let capturedUserPrompt: unknown;
    const prompt = vi.fn(async (input: string) => {
      capturedUserPrompt = input;
      return "answer";
    });
    (selfScope()["self"] as Record<string, unknown>)["LanguageModel"] = {
      availability: async () => "available",
      create: vi.fn(async (opts: { systemPrompt?: string }) => {
        capturedSystemPrompt = opts.systemPrompt;
        return { prompt };
      }),
    };

    const result = await askFloodplainQuestion("What does freeboard mean?");
    expect(result.ok).toBe(true);
    expect(String(capturedSystemPrompt)).toContain(GOVERNING_AXIOM);
    expect(String(capturedUserPrompt)).toContain("What does freeboard mean?");
  });

  it("summarizeEvidencePacket uses the Summarizer API and returns provenance", async () => {
    const summarize = vi.fn(async () => "- key point one\n- key point two");
    (selfScope()["self"] as Record<string, unknown>)["Summarizer"] = {
      availability: async () => "available",
      create: vi.fn(async () => ({ summarize })),
    };

    const result = await summarizeEvidencePacket({
      packetId: "pkt-001",
      title: "LOMA evidence packet",
      items: ["Elevation certificate", "FIRM panel 18073C"],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain("key point one");
      expect(result.provenance).toBe("model-generated");
      expect(result.label).toBe(PROVISIONAL_LABEL);
    }
    expect(summarize).toHaveBeenCalledTimes(1);
  });

  it("proofreadFiling uses the Proofreader API and returns corrected text", async () => {
    const proofread = vi.fn(async () => ({ correctedInput: "Corrected filing text." }));
    (selfScope()["self"] as Record<string, unknown>)["Proofreader"] = {
      availability: async () => "available",
      create: vi.fn(async () => ({ proofread })),
    };

    const result = await proofreadFiling("filling text with erors");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe("Corrected filing text.");
      expect(result.provenance).toBe("model-generated");
      expect(result.label).toBe(PROVISIONAL_LABEL);
    }
  });

  it("fail-closed: returns unavailable when the needed API is missing", async () => {
    const r1 = await explainFloodResult({ scenarioName: "x", keyFindings: [] });
    const r2 = await summarizeEvidencePacket({ packetId: "p", title: "t", items: [] });
    const r3 = await proofreadFiling("some text");
    for (const r of [r1, r2, r3]) {
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.status).toBe("unavailable");
        expect(r.reason.length).toBeGreaterThan(0);
        expect(r.humanReviewRequired).toBe(true);
      }
    }
  });

  it("fail-closed: never returns a fake result while the model is downloading", async () => {
    (selfScope()["self"] as Record<string, unknown>)["LanguageModel"] = {
      availability: async () => "downloading",
      create: vi.fn(),
    };
    const result = await askFloodplainQuestion("hello");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/downloading|not ready/i);
  });

  it("fail-closed: session creation failure yields unavailable, never throws", async () => {
    (selfScope()["self"] as Record<string, unknown>)["LanguageModel"] = {
      availability: async () => "available",
      create: async () => {
        throw new Error("denied");
      },
    };
    const result = await askFloodplainQuestion("hello");
    expect(result.ok).toBe(false);
  });

  it("rejects empty inputs without touching the APIs", async () => {
    const create = vi.fn();
    (selfScope()["self"] as Record<string, unknown>)["LanguageModel"] = {
      availability: async () => "available",
      create,
    };
    const r1 = await askFloodplainQuestion("   ");
    const r2 = await proofreadFiling("");
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it("makes zero fetch calls across every assistant path", async () => {
    (selfScope()["self"] as Record<string, unknown>)["LanguageModel"] = {
      availability: async () => "available",
      create: async () => ({ prompt: async () => "ok" }),
    };
    (selfScope()["self"] as Record<string, unknown>)["Summarizer"] = {
      availability: async () => "available",
      create: async () => ({ summarize: async () => "ok" }),
    };
    (selfScope()["self"] as Record<string, unknown>)["Proofreader"] = {
      availability: async () => "available",
      create: async () => ({ proofread: async () => ({ correctedInput: "ok" }) }),
    };

    await explainFloodResult({ scenarioName: "s", keyFindings: ["f"] });
    await askFloodplainQuestion("q");
    await summarizeEvidencePacket({ packetId: "p", title: "t", items: ["i"] });
    await proofreadFiling("text");
    // unavailable paths too
    clearGlobals();
    await explainFloodResult({ scenarioName: "s", keyFindings: [] });
    await summarizeEvidencePacket({ packetId: "p", title: "t", items: [] });
    await proofreadFiling("text");

    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });
});

/**
 * Tests for local-ai/availability.
 * - Availability token mapping (available/downloading/unavailable).
 * - Never throws on unsupported environments (missing `self`, missing globals,
 *   throwing availability()).
 * - Zero fetch calls on the local-AI path.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getLocalAiCapabilities } from "../src/lib/local-ai/availability";

function setBuiltinGlobals(defs: Record<string, unknown>) {
  const selfScope = (globalThis as Record<string, unknown>)["self"] as Record<
    string,
    unknown
  >;
  for (const [name, def] of Object.entries(defs)) {
    selfScope[name] = def;
  }
}

function clearBuiltinGlobals() {
  const selfScope = (globalThis as Record<string, unknown>)["self"] as
    | Record<string, unknown>
    | undefined;
  if (!selfScope || typeof selfScope !== "object") return;
  for (const name of ["LanguageModel", "Summarizer", "Proofreader", "Writer"]) {
    delete selfScope[name];
  }
}

function okFactory(status: string) {
  return {
    availability: async () => status,
    create: async () => ({}),
  };
}

describe("local-ai availability", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    // Provide a browser-like `self` scope.
    (globalThis as Record<string, unknown>)["self"] = globalThis;
    clearBuiltinGlobals();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    clearBuiltinGlobals();
    fetchSpy?.mockRestore();
    vi.unstubAllGlobals();
  });

  it("maps 'available' tokens to available", async () => {
    setBuiltinGlobals({
      LanguageModel: okFactory("available"),
      Summarizer: okFactory("readily"),
      Proofreader: okFactory("available"),
      Writer: okFactory("readily"),
    });
    const report = await getLocalAiCapabilities();
    expect(report.capabilities.prompt.status).toBe("available");
    expect(report.capabilities.summarizer.status).toBe("available");
    expect(report.capabilities.proofreader.status).toBe("available");
    expect(report.capabilities.writer.status).toBe("available");
    expect(report.overall).toBe("available");
    expect(report.reason).toMatch(/ready/i);
  });

  it("maps download-related tokens to downloading", async () => {
    setBuiltinGlobals({
      LanguageModel: okFactory("downloadable"),
      Summarizer: okFactory("downloading"),
    });
    const report = await getLocalAiCapabilities();
    expect(report.capabilities.prompt.status).toBe("downloading");
    expect(report.capabilities.summarizer.status).toBe("downloading");
    expect(report.overall).toBe("downloading");
  });

  it("maps negative/unknown tokens to unavailable", async () => {
    setBuiltinGlobals({
      LanguageModel: okFactory("no"),
      Summarizer: okFactory("unavailable"),
      Proofreader: okFactory("definitely-not-a-token"),
    });
    const report = await getLocalAiCapabilities();
    expect(report.capabilities.prompt.status).toBe("unavailable");
    expect(report.capabilities.summarizer.status).toBe("unavailable");
    expect(report.capabilities.proofreader.status).toBe("unavailable");
    expect(report.overall).toBe("unavailable");
    expect(report.reason.length).toBeGreaterThan(0);
  });

  it("never throws when built-in AI globals are missing entirely", async () => {
    const report = await getLocalAiCapabilities();
    expect(report.overall).toBe("unavailable");
    expect(report.capabilities.prompt.status).toBe("unavailable");
    expect(report.capabilities.prompt.reason).toMatch(/not exposed/i);
  });

  it("never throws when `self` is undefined (e.g. SSR / non-browser)", async () => {
    vi.stubGlobal("self", undefined);
    const report = await getLocalAiCapabilities();
    expect(report.overall).toBe("unavailable");
  });

  it("never throws when availability() itself throws", async () => {
    setBuiltinGlobals({
      LanguageModel: {
        availability: async () => {
          throw new Error("boom");
        },
      },
    });
    const report = await getLocalAiCapabilities();
    expect(report.capabilities.prompt.status).toBe("unavailable");
    expect(report.overall).toBe("unavailable");
  });

  it("treats a global without availability() as unavailable", async () => {
    setBuiltinGlobals({ LanguageModel: { create: async () => ({}) } });
    const report = await getLocalAiCapabilities();
    expect(report.capabilities.prompt.status).toBe("unavailable");
  });

  it("makes zero fetch calls during probing", async () => {
    setBuiltinGlobals({ LanguageModel: okFactory("available") });
    await getLocalAiCapabilities();
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });
});

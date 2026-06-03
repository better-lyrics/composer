import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileLine } from "@/domain/line/model";
import { generateForWord } from "@/lib/romanization/generate";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";

vi.mock("@/utils/turnstile", () => ({
  runTurnstile: vi.fn(async () => "tok"),
}));

// -- Fixtures -----------------------------------------------------------------

function buildLine(id: string, text: string, words?: { text: string; begin: number; end: number }[]) {
  return reconcileLine({
    id,
    text,
    agentId: "v1",
    ...(words ? { words } : { begin: 0, end: 1 }),
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// -- Suite --------------------------------------------------------------------

describe("generateForWord", () => {
  let fetchStub: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    useProjectStore.setState(useProjectStore.getInitialState());
    useSettingsStore.setState({ romanizationApiBase: "", romanizationTurnstileSiteKey: "dev-key" });
    fetchStub = vi.fn();
    vi.stubGlobal("fetch", fetchStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("posts a one-line one-word payload", async () => {
    const line = buildLine("L1", "夜だけど", [
      { text: "夜", begin: 0, end: 1 },
      { text: "だけど", begin: 1, end: 2 },
    ]);
    useProjectStore.getState().setLinesWithHistory([line]);
    fetchStub.mockResolvedValue(
      jsonResponse({
        results: [{ id: "L1", lang: "ja", scheme: "ja-Latn-hepburn", text: "dakedo", engine: "cutlet", tier: 0 }],
        errors: [],
      }),
    );

    await generateForWord("ja-Latn-hepburn", line, 1);

    const body = JSON.parse(fetchStub.mock.calls[0][1].body as string);
    expect(body.lines).toEqual([{ id: "L1", text: "だけど" }]);
  });

  it("initialises wordTexts when absent and updates only the chosen index", async () => {
    const line = buildLine("L1", "夜だけど", [
      { text: "夜", begin: 0, end: 1 },
      { text: "だけど", begin: 1, end: 2 },
    ]);
    useProjectStore.getState().setLinesWithHistory([line]);
    fetchStub.mockResolvedValue(
      jsonResponse({
        results: [{ id: "L1", lang: "ja", scheme: "ja-Latn-hepburn", text: "dakedo", engine: "cutlet", tier: 0 }],
        errors: [],
      }),
    );

    const summary = await generateForWord("ja-Latn-hepburn", line, 1);

    expect(summary).toEqual({ successCount: 1, failureCount: 0 });
    const stored = useProjectStore.getState().lines[0];
    expect(stored.romanization?.wordTexts).toEqual(["", "dakedo"]);
    expect(stored.romanization?.text).toBe(" dakedo");
    expect(stored.romanization?.source).toBe("generated");
  });

  it("updates an existing wordTexts entry without disturbing siblings", async () => {
    const line = buildLine("L1", "夜だけど", [
      { text: "夜", begin: 0, end: 1 },
      { text: "だけど", begin: 1, end: 2 },
    ]);
    useProjectStore.getState().setLinesWithHistory([line]);
    useProjectStore.getState().setLineRomanizationWithHistory("L1", {
      text: "yoru sakedo",
      wordTexts: ["yoru", "sakedo"],
      source: "generated",
      engine: "cutlet",
    });
    fetchStub.mockResolvedValue(
      jsonResponse({
        results: [{ id: "L1", lang: "ja", scheme: "ja-Latn-hepburn", text: "dakedo", engine: "cutlet", tier: 0 }],
        errors: [],
      }),
    );

    await generateForWord("ja-Latn-hepburn", useProjectStore.getState().lines[0], 1);

    const stored = useProjectStore.getState().lines[0];
    expect(stored.romanization?.wordTexts).toEqual(["yoru", "dakedo"]);
    expect(stored.romanization?.text).toBe("yoru dakedo");
  });

  it("returns failure count 1 when API returns no results for the word", async () => {
    const line = buildLine("L1", "夜だけど", [
      { text: "夜", begin: 0, end: 1 },
      { text: "だけど", begin: 1, end: 2 },
    ]);
    useProjectStore.getState().setLinesWithHistory([line]);
    fetchStub.mockResolvedValue(
      jsonResponse({ results: [], errors: [{ id: "L1", reason: "all-chain-tiers-exhausted" }] }),
    );

    const summary = await generateForWord("ja-Latn-hepburn", line, 1);

    expect(summary).toEqual({ successCount: 0, failureCount: 1 });
    expect(useProjectStore.getState().lines[0].romanization).toBeUndefined();
  });

  it("returns failure when the wordIndex is out of range", async () => {
    const line = buildLine("L1", "夜だけど", [
      { text: "夜", begin: 0, end: 1 },
      { text: "だけど", begin: 1, end: 2 },
    ]);
    useProjectStore.getState().setLinesWithHistory([line]);

    const summary = await generateForWord("ja-Latn-hepburn", line, 99);

    expect(summary).toEqual({ successCount: 0, failureCount: 1 });
    expect(fetchStub).not.toHaveBeenCalled();
  });
});

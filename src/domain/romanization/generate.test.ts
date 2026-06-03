import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileLine } from "@/domain/line/model";
import { generateForLine, generateForLines, generateForWord } from "@/domain/romanization/generate";
import { RomanizationApiError, TurnstileError } from "@/lib/romanization-api";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";

// TDD policy: `fetch` is stubbed at the global level so the API client's parse
// path stays real (real Request shape, real Response object). `runTurnstile` is
// the only piece we cannot run in unit-test land because it loads a third-party
// Cloudflare script. Mocking it is the documented exception in the design doc.

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

describe("generateForLines", () => {
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

  it("builds the API payload from line ids, text, and words", async () => {
    const line = buildLine("L1", "夜だけど", [
      { text: "夜", begin: 0, end: 1 },
      { text: "だけど", begin: 1, end: 2 },
    ]);
    useProjectStore.getState().setLinesWithHistory([line]);
    fetchStub.mockResolvedValue(
      jsonResponse({
        results: [
          {
            id: "L1",
            lang: "ja",
            scheme: "ja-Latn-hepburn",
            text: "yoru dakedo",
            wordTexts: ["yoru", "dakedo"],
            engine: "cutlet",
            tier: 0,
          },
        ],
        errors: [],
      }),
    );

    await generateForLines("ja-Latn-hepburn", [line]);

    expect(fetchStub).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchStub.mock.calls[0][1].body as string);
    expect(body).toEqual({
      scheme: "ja-Latn-hepburn",
      lines: [{ id: "L1", text: "夜だけど", words: ["夜", "だけど"] }],
    });
  });

  it("omits words from the payload when the line has none", async () => {
    const line = buildLine("L1", "夜だけど");
    useProjectStore.getState().setLinesWithHistory([line]);
    fetchStub.mockResolvedValue(jsonResponse({ results: [], errors: [] }));

    await generateForLines("ja-Latn-hepburn", [line]);

    const body = JSON.parse(fetchStub.mock.calls[0][1].body as string);
    expect(body.lines[0]).toEqual({ id: "L1", text: "夜だけど" });
  });

  it("applies each result to the store via setLineRomanizationWithHistory", async () => {
    const line = buildLine("L1", "夜だけど", [
      { text: "夜", begin: 0, end: 1 },
      { text: "だけど", begin: 1, end: 2 },
    ]);
    useProjectStore.getState().setLinesWithHistory([line]);
    fetchStub.mockResolvedValue(
      jsonResponse({
        results: [
          {
            id: "L1",
            lang: "ja",
            scheme: "ja-Latn-hepburn",
            text: "yoru dakedo",
            wordTexts: ["yoru", "dakedo"],
            engine: "cutlet",
            tier: 0,
          },
        ],
        errors: [],
      }),
    );

    await generateForLines("ja-Latn-hepburn", [line]);

    const stored = useProjectStore.getState().lines[0];
    expect(stored.romanization?.text).toBe("yoru dakedo");
    expect(stored.romanization?.wordTexts).toEqual(["yoru", "dakedo"]);
    expect(stored.romanization?.engine).toBe("cutlet");
    expect(stored.romanization?.source).toBe("generated");
  });

  it("counts success and failure from results and errors arrays", async () => {
    const lineA = buildLine("L1", "夜");
    const lineB = buildLine("L2", "朝");
    useProjectStore.getState().setLinesWithHistory([lineA, lineB]);
    fetchStub.mockResolvedValue(
      jsonResponse({
        results: [{ id: "L1", lang: "ja", scheme: "ja-Latn-hepburn", text: "yoru", engine: "cutlet", tier: 0 }],
        errors: [{ id: "L2", reason: "all-chain-tiers-exhausted" }],
      }),
    );

    const summary = await generateForLines("ja-Latn-hepburn", [lineA, lineB]);

    expect(summary).toEqual({ successCount: 1, failureCount: 1 });
  });

  it("throws TurnstileError when site key is empty (skips network)", async () => {
    useSettingsStore.setState({ romanizationTurnstileSiteKey: "" });
    const original = import.meta.env.VITE_TURNSTILE_SITEKEY;
    import.meta.env.VITE_TURNSTILE_SITEKEY = "";
    const line = buildLine("L1", "夜");
    useProjectStore.getState().setLinesWithHistory([line]);

    await expect(generateForLines("ja-Latn-hepburn", [line])).rejects.toBeInstanceOf(TurnstileError);
    expect(fetchStub).not.toHaveBeenCalled();

    import.meta.env.VITE_TURNSTILE_SITEKEY = original;
  });

  it("surfaces RomanizationApiError from the API client without swallowing", async () => {
    const line = buildLine("L1", "夜");
    useProjectStore.getState().setLinesWithHistory([line]);
    fetchStub.mockResolvedValue(jsonResponse({ detail: "bad" }, 400));

    await expect(generateForLines("ja-Latn-hepburn", [line])).rejects.toBeInstanceOf(RomanizationApiError);
  });

  it("logs engine and tier per applied result", async () => {
    const line = buildLine("L1", "夜");
    useProjectStore.getState().setLinesWithHistory([line]);
    fetchStub.mockResolvedValue(
      jsonResponse({
        results: [{ id: "L1", lang: "ja", scheme: "ja-Latn-hepburn", text: "yoru", engine: "cutlet", tier: 0 }],
        errors: [],
      }),
    );
    const log = vi.spyOn(console, "info").mockImplementation(() => {});

    await generateForLines("ja-Latn-hepburn", [line]);

    const calls = log.mock.calls.map((c) => c.join(" "));
    expect(
      calls.some((c) => c.includes("[Composer:romanization]") && c.includes("engine=cutlet") && c.includes("tier=0")),
    ).toBe(true);
  });

  it("passes the abort signal through to fetch", async () => {
    const line = buildLine("L1", "夜");
    useProjectStore.getState().setLinesWithHistory([line]);
    const ctrl = new AbortController();
    fetchStub.mockImplementation((_url, init) => {
      const sig = init?.signal as AbortSignal | undefined;
      return new Promise((_resolve, reject) => {
        sig?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        queueMicrotask(() => ctrl.abort());
      });
    });
    const p = generateForLines("ja-Latn-hepburn", [line], ctrl.signal);
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("generateForLine", () => {
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

  it("wraps a single line and returns success counts", async () => {
    const line = buildLine("L1", "夜");
    useProjectStore.getState().setLinesWithHistory([line]);
    fetchStub.mockResolvedValue(
      jsonResponse({
        results: [{ id: "L1", lang: "ja", scheme: "ja-Latn-hepburn", text: "yoru", engine: "cutlet", tier: 0 }],
        errors: [],
      }),
    );

    const summary = await generateForLine("ja-Latn-hepburn", line);

    expect(summary).toEqual({ successCount: 1, failureCount: 0 });
    const body = JSON.parse(fetchStub.mock.calls[0][1].body as string);
    expect(body.lines).toHaveLength(1);
    expect(body.lines[0].id).toBe("L1");
  });

  it("returns failure count 1 when the API returns an error for the line", async () => {
    const line = buildLine("L1", "夜");
    useProjectStore.getState().setLinesWithHistory([line]);
    fetchStub.mockResolvedValue(
      jsonResponse({ results: [], errors: [{ id: "L1", reason: "all-chain-tiers-exhausted" }] }),
    );

    const summary = await generateForLine("ja-Latn-hepburn", line);

    expect(summary).toEqual({ successCount: 0, failureCount: 1 });
  });
});

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

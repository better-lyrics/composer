import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileLine } from "@/domain/line/model";
import { generateForLine } from "@/lib/romanization/generate";
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

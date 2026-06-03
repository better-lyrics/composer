import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import { reconcileLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";
import { RomanizationSubrow } from "@/views/edit/romanization-subrow";

// `runTurnstile` loads a Cloudflare script that cannot run in browser tests.
// Every other layer (subrow, orchestrator, API client, store) runs for real.
vi.mock("@/utils/turnstile", () => ({
  runTurnstile: vi.fn(async () => "tok"),
}));

// -- Fixtures -----------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function seedLineWithRomanization(
  opts: {
    text?: string;
    words?: { text: string; begin: number; end: number }[];
    romanizationText?: string;
    wordTexts?: string[];
  } = {},
): LyricLine {
  useProjectStore.setState(useProjectStore.getInitialState());
  useProjectStore.getState().setMetadata({ romanizationScheme: "ja-Latn-hepburn" });
  useProjectStore.getState().setLinesWithHistory([
    reconcileLine({
      id: "L1",
      text: opts.text ?? "夜だけど",
      agentId: "v1",
      words: opts.words ?? [
        { text: "夜", begin: 0, end: 1 },
        { text: "だけど", begin: 1, end: 2 },
      ],
    }),
  ]);
  if (opts.romanizationText !== undefined) {
    useProjectStore.getState().setLineRomanizationWithHistory("L1", {
      text: opts.romanizationText,
      ...(opts.wordTexts ? { wordTexts: opts.wordTexts } : {}),
      source: "generated",
    });
  }
  return useProjectStore.getState().lines[0];
}

let fetchStub: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchStub = vi.fn();
  vi.stubGlobal("fetch", fetchStub);
  useSettingsStore.setState({ romanizationApiBase: "", romanizationTurnstileSiteKey: "test-key" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// -- Display ------------------------------------------------------------------

describe("RomanizationSubrow display", () => {
  it("renders nothing when the line has no romanization", async () => {
    const line = seedLineWithRomanization();
    const screen = await render(<RomanizationSubrow line={line} />);
    await expect.element(screen.getByTestId("romanization-subrow")).not.toBeInTheDocument();
  });

  it("renders space-joined wordTexts when arity matches line.words", async () => {
    const line = seedLineWithRomanization({
      romanizationText: "yoru dakedo",
      wordTexts: ["yoru", "dakedo"],
    });
    const screen = await render(<RomanizationSubrow line={line} />);
    await expect.element(screen.getByTestId("romanization-subrow")).toBeInTheDocument();
    const wordSpans = screen.getByTestId("romanization-word").elements();
    expect(wordSpans).toHaveLength(2);
    expect(wordSpans[0].textContent).toBe("yoru");
    expect(wordSpans[1].textContent).toBe("dakedo");
  });

  it("renders line-level text when wordTexts is absent", async () => {
    const line = seedLineWithRomanization({ romanizationText: "yoru dakedo" });
    const screen = await render(<RomanizationSubrow line={line} />);
    await expect.element(screen.getByTestId("romanization-subrow")).toBeInTheDocument();
    await expect.element(screen.getByTestId("romanization-line-text")).toHaveTextContent("yoru dakedo");
  });

  it("falls back to line-level text when wordTexts arity does not match line.words", async () => {
    useProjectStore.setState(useProjectStore.getInitialState());
    useProjectStore.getState().setMetadata({ romanizationScheme: "ja-Latn-hepburn" });
    useProjectStore.getState().setLinesWithHistory([
      reconcileLine({
        id: "L1",
        text: "夜だけど",
        agentId: "v1",
        words: [
          { text: "夜", begin: 0, end: 1 },
          { text: "だけど", begin: 1, end: 2 },
          { text: "ね", begin: 2, end: 3 },
        ],
      }),
    ]);
    useProjectStore.getState().setLineRomanizationWithHistory("L1", {
      text: "yoru dakedo",
      source: "generated",
    });
    const line = useProjectStore.getState().lines[0];
    const screen = await render(<RomanizationSubrow line={line} />);
    await expect.element(screen.getByTestId("romanization-line-text")).toHaveTextContent("yoru dakedo");
  });

  it("does not wire any per-word click handler in this task", async () => {
    const line = seedLineWithRomanization({
      romanizationText: "yoru dakedo",
      wordTexts: ["yoru", "dakedo"],
    });
    const screen = await render(<RomanizationSubrow line={line} />);
    const firstWord = screen.getByTestId("romanization-word").first();
    const el = firstWord.element() as HTMLElement;
    expect(el.getAttribute("data-clickable-word")).toBeNull();
  });
});

// -- Refresh button -----------------------------------------------------------

describe("RomanizationSubrow refresh", () => {
  it("calls the API and applies the result on refresh click", async () => {
    const line = seedLineWithRomanization({
      romanizationText: "stale",
      wordTexts: ["sta", "le"],
    });
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
    const screen = await render(<RomanizationSubrow line={line} />);
    const refreshButton = screen.getByRole("button", { name: /refresh romanization/i });
    await refreshButton.click();

    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.text).toBe("yoru dakedo");
    expect(fetchStub).toHaveBeenCalledOnce();
  });

  it("disables the refresh button while a refresh is in flight", async () => {
    const line = seedLineWithRomanization({ romanizationText: "yoru dakedo" });
    let resolveFetch: (response: Response) => void = () => {};
    fetchStub.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const screen = await render(<RomanizationSubrow line={line} />);
    const refreshButton = screen.getByRole("button", { name: /refresh romanization/i });
    await refreshButton.click();
    await expect.element(refreshButton).toBeDisabled();
    resolveFetch(jsonResponse({ results: [], errors: [] }));
    await expect.element(refreshButton).not.toBeDisabled();
  });
});

// -- Click opens popover ------------------------------------------------------

describe("RomanizationSubrow line-level edit affordance", () => {
  it("opens the line-level edit popover when the subrow text region is clicked", async () => {
    const line = seedLineWithRomanization({ romanizationText: "yoru dakedo" });
    const screen = await render(<RomanizationSubrow line={line} />);
    const textRegion = screen.getByTestId("romanization-text-region");
    await textRegion.click();
    await expect.element(screen.getByRole("textbox", { name: /romanization text/i })).toBeInTheDocument();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { LyricLine } from "@/domain/line/model";
import { reconcileLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";
import { RomanizationWordEditPopover } from "@/views/edit/romanization-word-edit-popover";

// `runTurnstile` loads a Cloudflare script that cannot run in browser tests.
// Every other layer (popover, orchestrator, API client, store) runs for real.
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

function seedLine(
  opts: {
    wordTexts?: string[];
    romanizationText?: string;
  } = {},
): LyricLine {
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
      ],
    }),
  ]);
  if (opts.romanizationText !== undefined || opts.wordTexts) {
    useProjectStore.getState().setLineRomanizationWithHistory("L1", {
      text: opts.romanizationText ?? (opts.wordTexts ?? []).join(" "),
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

// -- Open state --------------------------------------------------------------

describe("RomanizationWordEditPopover open state", () => {
  it("initialises the input with the current wordTexts[wordIndex]", async () => {
    const line = seedLine({ wordTexts: ["yoru", "dakedo"] });
    const screen = await render(<RomanizationWordEditPopover line={line} wordIndex={1} isOpen onClose={() => {}} />);
    const input = screen.getByRole("textbox", { name: /romanization word/i });
    await expect.element(input).toHaveValue("dakedo");
  });

  it("initialises with an empty string when wordTexts is absent", async () => {
    const line = seedLine();
    const screen = await render(<RomanizationWordEditPopover line={line} wordIndex={0} isOpen onClose={() => {}} />);
    const input = screen.getByRole("textbox", { name: /romanization word/i });
    await expect.element(input).toHaveValue("");
  });

  it("auto-focuses and selects the input on mount", async () => {
    const line = seedLine({ wordTexts: ["yoru", "dakedo"] });
    const screen = await render(<RomanizationWordEditPopover line={line} wordIndex={0} isOpen onClose={() => {}} />);
    const input = screen.getByRole("textbox", { name: /romanization word/i });
    const el = input.element() as HTMLInputElement;
    await expect.poll(() => document.activeElement).toBe(el);
  });
});

// -- Save --------------------------------------------------------------------

describe("RomanizationWordEditPopover save", () => {
  it("save updates only the indexed wordText and recomputes text=wordTexts.join(' ')", async () => {
    const line = seedLine({ wordTexts: ["yoru", "dakedo"] });
    let closed = false;
    const screen = await render(
      <RomanizationWordEditPopover
        line={line}
        wordIndex={1}
        isOpen
        onClose={() => {
          closed = true;
        }}
      />,
    );
    const input = screen.getByRole("textbox", { name: /romanization word/i });
    await input.fill("dakedoX");
    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.wordTexts).toEqual(["yoru", "dakedoX"]);
    expect(useProjectStore.getState().lines[0].romanization?.text).toBe("yoru dakedoX");
    expect(useProjectStore.getState().lines[0].romanization?.source).toBe("manual");
    expect(closed).toBe(true);
  });

  it("save with empty string leaves only that index empty", async () => {
    const line = seedLine({ wordTexts: ["yoru", "dakedo"] });
    const screen = await render(<RomanizationWordEditPopover line={line} wordIndex={0} isOpen onClose={() => {}} />);
    const input = screen.getByRole("textbox", { name: /romanization word/i });
    await input.fill("");
    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.wordTexts).toEqual(["", "dakedo"]);
    expect(useProjectStore.getState().lines[0].romanization?.text).toBe(" dakedo");
    expect(useProjectStore.getState().lines[0].romanization?.source).toBe("manual");
  });

  it("save seeds wordTexts with the line's word count when previously absent", async () => {
    const line = seedLine();
    const screen = await render(<RomanizationWordEditPopover line={line} wordIndex={1} isOpen onClose={() => {}} />);
    const input = screen.getByRole("textbox", { name: /romanization word/i });
    await input.fill("dakedo");
    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.wordTexts).toEqual(["", "dakedo"]);
    expect(useProjectStore.getState().lines[0].romanization?.source).toBe("manual");
  });
});

// -- Regenerate --------------------------------------------------------------

describe("RomanizationWordEditPopover regenerate", () => {
  it("regenerate calls the API, applies the new wordText, and closes the popover", async () => {
    const line = seedLine({ wordTexts: ["yoru", "stale"] });
    fetchStub.mockResolvedValue(
      jsonResponse({
        results: [
          {
            id: "L1",
            lang: "ja",
            scheme: "ja-Latn-hepburn",
            text: "dakedo",
            engine: "cutlet",
            tier: 0,
          },
        ],
        errors: [],
      }),
    );
    let closed = false;
    const screen = await render(
      <RomanizationWordEditPopover
        line={line}
        wordIndex={1}
        isOpen
        onClose={() => {
          closed = true;
        }}
      />,
    );
    await screen.getByRole("button", { name: /regenerate/i }).click();

    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.wordTexts).toEqual(["yoru", "dakedo"]);
    expect(fetchStub).toHaveBeenCalledOnce();
    await expect.poll(() => closed).toBe(true);
  });

  it("regenerate is disabled when the site key is empty", async () => {
    useSettingsStore.setState({ romanizationTurnstileSiteKey: "" });
    const line = seedLine({ wordTexts: ["yoru", "dakedo"] });
    const screen = await render(<RomanizationWordEditPopover line={line} wordIndex={1} isOpen onClose={() => {}} />);
    const regenerate = screen.getByRole("button", { name: /regenerate/i });
    await expect.element(regenerate).toBeDisabled();
    const el = regenerate.element() as HTMLButtonElement;
    expect(el.getAttribute("title")).toMatch(/turnstile site key/i);
  });
});

// -- Dismiss -----------------------------------------------------------------

describe("RomanizationWordEditPopover dismiss", () => {
  it("cancel closes without writing to the store", async () => {
    const line = seedLine({ wordTexts: ["yoru", "dakedo"] });
    let closed = false;
    const screen = await render(
      <RomanizationWordEditPopover
        line={line}
        wordIndex={1}
        isOpen
        onClose={() => {
          closed = true;
        }}
      />,
    );
    const input = screen.getByRole("textbox", { name: /romanization word/i });
    await input.fill("something else");
    await screen.getByRole("button", { name: /cancel/i }).click();

    expect(closed).toBe(true);
    expect(useProjectStore.getState().lines[0].romanization?.wordTexts).toEqual(["yoru", "dakedo"]);
  });

  it("Escape closes the popover", async () => {
    const line = seedLine({ wordTexts: ["yoru", "dakedo"] });
    let closed = false;
    const screen = await render(
      <RomanizationWordEditPopover
        line={line}
        wordIndex={1}
        isOpen
        onClose={() => {
          closed = true;
        }}
      />,
    );
    const input = screen.getByRole("textbox", { name: /romanization word/i });
    await input.click();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => closed).toBe(true);
  });
});

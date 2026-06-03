import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";
import { WordTrack } from "@/views/timeline/word-track";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// `runTurnstile` loads a Cloudflare script that cannot run in browser tests.
// Every other layer (track, popover, orchestrator, API client, store) runs for real.
vi.mock("@/utils/turnstile", () => ({
  runTurnstile: vi.fn(async () => "tok"),
}));

// -- Fixtures -----------------------------------------------------------------

function seedLine(opts: {
  words?: { text: string; begin: number; end: number }[];
  wordTexts?: string[];
}) {
  useProjectStore.setState(useProjectStore.getInitialState());
  useProjectStore.getState().setMetadata({ romanizationScheme: "ja-Latn-hepburn" });
  useProjectStore.getState().setLinesWithHistory([
    reconcileLine({
      id: "L1",
      text: "夜だけど",
      agentId: "v1",
      words: opts.words ?? [
        { text: "夜", begin: 0, end: 1 },
        { text: "だけど", begin: 1, end: 2 },
      ],
    }),
  ]);
  if (opts.wordTexts) {
    useProjectStore.getState().setLineRomanizationWithHistory("L1", {
      text: opts.wordTexts.join(" "),
      wordTexts: opts.wordTexts,
      source: "generated",
    });
  }
}

function getLineRomanization() {
  return useProjectStore.getState().lines[0]?.romanization;
}

let fetchStub: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchStub = vi.fn();
  vi.stubGlobal("fetch", fetchStub);
  useSettingsStore.setState({ romanizationApiBase: "", romanizationTurnstileSiteKey: "test-key" });
  useTimelineStore.setState({ primaryWordText: "source", zoom: 50 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// -- Render helpers ----------------------------------------------------------

async function renderTrack() {
  const line = useProjectStore.getState().lines[0];
  return render(
    <WordTrack
      lineId={line.id}
      lineIndex={0}
      words={line.words!}
      color="#a3c9ff"
      trackType="word"
      duration={4}
      height={44}
      romanization={line.romanization}
      onUpdateWord={() => {}}
    />,
    { dndContext: true },
  );
}

// -- Tests --------------------------------------------------------------------

describe("WordBlock romanization subtext", () => {
  it("renders the romaji subtext under each word when wordTexts arity matches", async () => {
    seedLine({ wordTexts: ["yoru", "dakedo"] });
    const screen = await renderTrack();
    const blocks = screen.container.querySelectorAll("[data-word-block]");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].querySelector("[data-word-block-primary]")?.textContent).toBe("夜");
    expect(blocks[0].querySelector("[data-word-block-secondary]")?.textContent).toBe("yoru");
    expect(blocks[1].querySelector("[data-word-block-primary]")?.textContent).toBe("だけど");
    expect(blocks[1].querySelector("[data-word-block-secondary]")?.textContent).toBe("dakedo");
  });

  it("renders no secondary subtext when the line has no romanization", async () => {
    seedLine({});
    const screen = await renderTrack();
    const blocks = screen.container.querySelectorAll("[data-word-block]");
    expect(blocks[0].querySelector("[data-word-block-secondary]")).toBeNull();
    expect(blocks[1].querySelector("[data-word-block-secondary]")).toBeNull();
  });

  it("renders no secondary subtext when wordTexts arity mismatches", async () => {
    seedLine({ wordTexts: ["yoru"] });
    const screen = await renderTrack();
    const blocks = screen.container.querySelectorAll("[data-word-block]");
    expect(blocks[0].querySelector("[data-word-block-secondary]")).toBeNull();
    expect(blocks[1].querySelector("[data-word-block-secondary]")).toBeNull();
  });

  it("hides the secondary subtext when the block is narrower than the romaji threshold", async () => {
    seedLine({
      words: [
        { text: "夜", begin: 0, end: 0.2 },
        { text: "だけど", begin: 0.5, end: 2 },
      ],
      wordTexts: ["yoru", "dakedo"],
    });
    const screen = await renderTrack();
    const blocks = screen.container.querySelectorAll("[data-word-block]");
    expect(blocks[0].querySelector("[data-word-block-secondary]")).toBeNull();
    expect(blocks[1].querySelector("[data-word-block-secondary]")?.textContent).toBe("dakedo");
  });

  it("swaps primary and secondary when primaryWordText is 'romaji'", async () => {
    seedLine({ wordTexts: ["yoru", "dakedo"] });
    useTimelineStore.setState({ primaryWordText: "romaji" });
    const screen = await renderTrack();
    const blocks = screen.container.querySelectorAll("[data-word-block]");
    expect(blocks[0].querySelector("[data-word-block-primary]")?.textContent).toBe("yoru");
    expect(blocks[0].querySelector("[data-word-block-secondary]")?.textContent).toBe("夜");
    expect(blocks[1].querySelector("[data-word-block-primary]")?.textContent).toBe("dakedo");
    expect(blocks[1].querySelector("[data-word-block-secondary]")?.textContent).toBe("だけど");
  });

  it("Alt+click on a word opens the romanization popover with the line and word index", async () => {
    seedLine({ wordTexts: ["yoru", "dakedo"] });
    const screen = await renderTrack();
    const blocks = screen.container.querySelectorAll("[data-word-block]");
    (blocks[1] as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, altKey: true, button: 0 }));
    const input = await screen.getByRole("textbox", { name: /romanization word/i });
    await expect.element(input).toHaveValue("dakedo");
  });

  it("Alt+click does NOTHING when wordTexts arity mismatches", async () => {
    seedLine({ wordTexts: ["yoru"] });
    const screen = await renderTrack();
    const blocks = screen.container.querySelectorAll("[data-word-block]");
    (blocks[0] as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, altKey: true, button: 0 }));
    const popover = screen.container.querySelector("input[aria-label='Romanization word']");
    expect(popover).toBeNull();
  });

  it("Alt+click is inert when the line has no romanization yet", async () => {
    seedLine({});
    const screen = await renderTrack();
    const blocks = screen.container.querySelectorAll("[data-word-block]");
    (blocks[0] as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, altKey: true, button: 0 }));
    expect(screen.container.querySelector("input[aria-label='Romanization word']")).toBeNull();
  });

  it("Alt+click tooltip on each word reads ALT+click to edit romaji when arity matches", async () => {
    seedLine({ wordTexts: ["yoru", "dakedo"] });
    const screen = await renderTrack();
    const blocks = screen.container.querySelectorAll("[data-word-block]");
    expect((blocks[0] as HTMLElement).getAttribute("title")).toMatch(/click to edit romaji/i);
  });

  it("preserves Save semantics: editing via popover updates only the indexed wordText", async () => {
    seedLine({ wordTexts: ["yoru", "dakedo"] });
    const screen = await renderTrack();
    const blocks = screen.container.querySelectorAll("[data-word-block]");
    (blocks[1] as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, altKey: true, button: 0 }));
    const input = await screen.getByRole("textbox", { name: /romanization word/i });
    await input.fill("dakedoX");
    await screen.getByRole("button", { name: /^save$/i }).click();
    await expect.poll(() => getLineRomanization()?.wordTexts).toEqual(["yoru", "dakedoX"]);
    expect(getLineRomanization()?.source).toBe("manual");
  });
});

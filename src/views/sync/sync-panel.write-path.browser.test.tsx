import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";
import { effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { setCurrentTime, setIsPlaying } from "@/test/sync-gesture-helpers";
import { SyncPanel } from "@/views/sync/sync-panel";

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 30));
}

function load(lines: LyricLine[], opts: { playing?: boolean; time?: number; granularity?: "line" | "word" } = {}) {
  useAudioStore.setState({
    source: { type: "file", file: createAudioFile() },
    duration: 60,
    currentTime: opts.time ?? 0,
    isPlaying: opts.playing ?? true,
  });
  useProjectStore.setState({ lines, activeTab: "sync", granularity: opts.granularity ?? "word" });
}

function key(init: KeyboardEventInit, type: "keydown" | "keyup" = "keydown"): void {
  window.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init }));
}

async function tapAt(time: number): Promise<void> {
  setCurrentTime(time);
  await settle();
  key({ key: " ", code: "Space" });
  await settle();
}

async function undo(): Promise<void> {
  key({ key: "z", code: "KeyZ", metaKey: true });
  await settle();
}

function lines(): LyricLine[] {
  return useProjectStore.getState().lines;
}

function wordTexts(i: number): string[] {
  return (lines()[i].words ?? []).map((w) => w.text);
}

function assertMonotonic(allLines: LyricLine[]): void {
  const flat = allLines.flatMap((l) => {
    if (l.words) return l.words;
    if (isLineSynced(l)) return [{ text: l.text, begin: l.begin, end: l.end }];
    return [];
  });
  for (let i = 0; i < flat.length; i++) {
    expect(flat[i].end, `word ${i} "${flat[i].text}" end >= begin`).toBeGreaterThanOrEqual(flat[i].begin);
    if (i > 0)
      expect(flat[i].begin, `word ${i} "${flat[i].text}" begins after previous end`).toBeGreaterThanOrEqual(
        flat[i - 1].end,
      );
  }
}

describe("D2 undo mid word-sync", () => {
  it("after undo the next tap re-times the undone word instead of skipping it", async () => {
    load([createLine({ id: "l0", text: "I heard the rumors going round" })]);
    await render(<SyncPanel />);
    await tapAt(1);
    await tapAt(2);
    await tapAt(3);
    expect(wordTexts(0)).toEqual(["I ", "heard ", "the "]);
    await undo();
    expect(wordTexts(0)).toEqual(["I ", "heard "]);
    await tapAt(4);
    expect(wordTexts(0)).toEqual(["I ", "heard ", "the "]);
  });

  it("a later deriveText write (arrow nudge) does not delete the skipped word from line text", async () => {
    load([createLine({ id: "l0", text: "I heard the rumors going round" })]);
    await render(<SyncPanel />);
    await tapAt(1);
    await tapAt(2);
    await tapAt(3);
    await undo();
    await tapAt(4);
    key({ key: "ArrowLeft", code: "ArrowLeft" });
    await settle();
    expect(lines()[0].text).toContain("the rumors");
  });
});

describe("sibling: nudge mid-sync truncates untapped text", () => {
  it("arrow nudge after the first tap keeps the whole line text", async () => {
    load([createLine({ id: "l0", text: "one two three" })]);
    await render(<SyncPanel />);
    await tapAt(1);
    key({ key: "ArrowLeft", code: "ArrowLeft" });
    await settle();
    expect(lines()[0].text).toBe("one two three");
  });
});

describe("D3 re-record from a clicked word", () => {
  function syncedLine(): LyricLine {
    const texts = ["I ", "heard ", "the ", "rumors ", "going ", "round"];
    return createLine({
      id: "l0",
      text: "I heard the rumors going round",
      words: texts.map((text, i) => ({ text, begin: 1 + i, end: 2 + i })),
    });
  }

  it("keeps every word and never zero-lengths earlier words when the tap lands during the preroll", async () => {
    load([syncedLine()], { playing: false, time: 0 });
    const screen = await render(<SyncPanel />);
    await screen.getByRole("button", { name: "rumors", exact: true }).click();
    await settle();
    expect(useAudioStore.getState().currentTime).toBeCloseTo(4 - 1.5);
    key({ key: " ", code: "Space" });
    await settle();
    expect(useAudioStore.getState().isPlaying).toBe(true);
    await tapAt(2.6);
    await tapAt(2.9);
    const words = lines()[0].words ?? [];
    expect(words.map((w) => w.text)).toEqual(["I ", "heard ", "the ", "rumors ", "going ", "round"]);
    for (const w of words.slice(0, 3)) expect(w.end - w.begin, `${w.text} keeps duration`).toBeGreaterThan(0);
  });

  it("regression: moves a late tapped word earlier without snapping back to its old begin", async () => {
    load([createLine({ id: "l0", text: "a b c" })]);
    const screen = await render(
      <>
        <Toaster />
        <SyncPanel />
      </>,
    );
    await tapAt(1);
    await tapAt(2);
    await tapAt(3);
    setIsPlaying(false);
    await screen.getByRole("button", { name: "b", exact: true }).click();
    await settle();
    key({ key: " ", code: "Space" });
    await tapAt(1.6);

    expect(lines()[0].words?.map((w) => [w.begin, w.end])).toEqual([
      [1, 1.6],
      [1.6, 1.6 + 0.3],
      [3, 3.3],
    ]);
    await expect.element(screen.getByText(/Early tap snapped/)).not.toBeInTheDocument();
  });
});

describe("D5 tap behind the previous committed time", () => {
  it("word mode, same line: backwards tap never yields end < begin or out-of-order words", async () => {
    load([createLine({ id: "l0", text: "a b c" })]);
    await render(<SyncPanel />);
    await tapAt(5);
    await tapAt(6);
    await tapAt(1);
    assertMonotonic(lines());
  });

  it("word mode, across lines: closing the previous line never writes end < begin", async () => {
    load([createLine({ id: "l0", text: "a b" }), createLine({ id: "l1", text: "c d" })]);
    await render(<SyncPanel />);
    await tapAt(5);
    await tapAt(6);
    await tapAt(2);
    assertMonotonic(lines());
  });

  it("line mode: backwards tap never writes previous line end < begin", async () => {
    load([createLine({ id: "l0", text: "first" }), createLine({ id: "l1", text: "second" })], { granularity: "line" });
    await render(<SyncPanel />);
    await tapAt(5);
    await tapAt(2);
    assertMonotonic(lines());
  });
});

describe("song end keeps sync armed", () => {
  it("after playback stops mid-sync, the next Space restarts playback with the cursor still mid-song", async () => {
    load([createLine({ id: "l0", text: "a b" }), createLine({ id: "l1", text: "c d" })]);
    await render(<SyncPanel />);
    await tapAt(50);
    await tapAt(51);
    setIsPlaying(false);
    await settle();
    key({ key: " ", code: "Space" });
    await settle();
    expect(useAudioStore.getState().isPlaying).toBe(true);
    await tapAt(0.2);
    assertMonotonic(lines());
  });
});

describe("T3 tap then hold across a line boundary", () => {
  it("holding the first word of the next line closes the tapped previous word", async () => {
    load([createLine({ id: "l0", text: "a b" }), createLine({ id: "l1", text: "c d" })]);
    await render(<SyncPanel />);
    await tapAt(5);
    await tapAt(6);
    setCurrentTime(6.1);
    await settle();
    key({ key: "f", code: "KeyF" });
    await settle();
    expect(lines()[0].words?.[1].end).toBe(6.1);
  });

  it("sibling: hold-tap that crosses into an already synced line keeps that line's other words", async () => {
    load(
      [
        createLine({
          id: "l0",
          text: "a b",
          words: [
            { text: "a ", begin: 1, end: 2 },
            { text: "b", begin: 2, end: 3 },
          ],
        }),
        createLine({
          id: "l1",
          text: "c d",
          words: [
            { text: "c ", begin: 10, end: 11 },
            { text: "d", begin: 11, end: 12 },
          ],
        }),
      ],
      { playing: false },
    );
    const screen = await render(<SyncPanel />);
    await screen.getByRole("button", { name: "b", exact: true }).click();
    await settle();
    setCurrentTime(2);
    key({ key: "f", code: "KeyF" });
    await settle();
    setCurrentTime(3);
    await settle();
    key({ key: " ", code: "Space" });
    await settle();
    expect(wordTexts(1)).toEqual(["c ", "d"]);
  });
});

describe("T4 nudge targets the last tapped word", () => {
  it("ArrowRight right after a tap nudges that word, not the last timed word of the song", async () => {
    load([
      createLine({ id: "l0", text: "a b" }),
      createLine({
        id: "l1",
        text: "c d",
        words: [
          { text: "c ", begin: 10, end: 11 },
          { text: "d", begin: 11, end: 12 },
        ],
      }),
    ]);
    await render(<SyncPanel />);
    await tapAt(1);
    key({ key: "ArrowRight", code: "ArrowRight" });
    await settle();
    expect(lines()[1].words?.[1].begin).toBe(11);
    expect(lines()[0].words?.[0].begin).toBeGreaterThan(1);
  });
});

describe("T5 background vocals after re-syncing the main line", () => {
  it("line bounds follow the re-synced main words, not stale imported bg timing", async () => {
    load([
      createLine({
        id: "l0",
        text: "hello world",
        begin: 26,
        end: 28,
        backgroundText: "oh oh",
        backgroundWords: [
          createWord({ text: "oh ", begin: 26.5, end: 27.25 }),
          createWord({ text: "oh", begin: 27.25, end: 28 }),
        ],
      }),
    ]);
    await render(<SyncPanel />);
    await tapAt(5);
    await tapAt(5.4);
    const bounds = effectiveBounds(lines()[0]);
    expect(bounds?.end).toBeLessThan(10);
  });
});

describe("T10 line-mode tap on a word-synced line", () => {
  it("a line-mode tap moves the line", async () => {
    load(
      [
        createLine({
          id: "l0",
          text: "a b",
          words: [
            { text: "a ", begin: 20, end: 21 },
            { text: "b", begin: 21, end: 22 },
          ],
        }),
        createLine({ id: "l1", text: "c" }),
      ],
      { granularity: "line" },
    );
    await render(<SyncPanel />);
    const historyBefore = useProjectStore.getState().history.length;
    await tapAt(3);
    expect(useProjectStore.getState().history.length).toBeGreaterThan(historyBefore);
    expect(effectiveBounds(lines()[0])?.begin).toBe(3);
  });
});

describe("one tap = one history entry at a line boundary", () => {
  it("undoing the two latest taps removes exactly those two taps", async () => {
    load([
      createLine({ id: "l0", text: "a" }),
      createLine({ id: "l1", text: "b" }),
      createLine({ id: "l2", text: "c" }),
    ]);
    await render(<SyncPanel />);
    await tapAt(1);
    await tapAt(2);
    await tapAt(3);
    await undo();
    await undo();
    expect(lines()[1].words).toBeUndefined();
  });
});

describe("U2 line counter", () => {
  it("counts only syncable lines in the denominator", async () => {
    load(
      [createLine({ id: "l0", text: "a" }), createLine({ id: "blank", text: "" }), createLine({ id: "l2", text: "b" })],
      {
        granularity: "line",
      },
    );
    const screen = await render(<SyncPanel />);
    await tapAt(1);
    await tapAt(2);
    await settle();
    expect(screen.container.querySelector("h2 + span")?.textContent).toBe("2/2");
  });
});

describe("U3 completion while words are unsynced", () => {
  it("does not claim Sync complete when a word is untimed", async () => {
    load([createLine({ id: "l0", text: "a b c" })]);
    const screen = await render(<SyncPanel />);
    await tapAt(1);
    await tapAt(2);
    await tapAt(3);
    await undo();
    expect(lines()[0].words?.length).toBe(2);
    await settle();
    expect(screen.container.textContent).not.toContain("Sync complete!");
  });
});

describe("end of lyrics", () => {
  it("says Sync complete only when every syncable line is fully timed", async () => {
    load([createLine({ id: "l0", text: "a b" })]);
    const screen = await render(<SyncPanel />);
    await tapAt(1);
    await tapAt(2);
    expect(screen.container.textContent).toContain("Sync complete!");
  });

  it("says lines still need timing when the cursor passed the end after a jump", async () => {
    load(
      [
        createLine({ id: "l0", text: "a b" }),
        createLine({ id: "l1", text: "c", words: [{ text: "c", begin: 9, end: 10 }] }),
      ],
      { playing: false },
    );
    const screen = await render(<SyncPanel />);
    await screen.getByRole("button", { name: "c", exact: true }).click();
    await settle();
    key({ key: " ", code: "Space" });
    await settle();
    await tapAt(11);
    expect(screen.container.textContent).not.toContain("Sync complete!");
    expect(screen.container.textContent).toContain("Some lines still need timing");
  });
});

describe("early tap flag (P1)", () => {
  it("tells the user when a tap was snapped to the previous word", async () => {
    load([createLine({ id: "l0", text: "a b c" })]);
    const screen = await render(
      <>
        <Toaster />
        <SyncPanel />
      </>,
    );
    await tapAt(5);
    await tapAt(6);
    await tapAt(1);
    await expect.element(screen.getByText("Early tap snapped to 0:06.000")).toBeVisible();
  });
});

describe("song end stops the session (P2)", () => {
  it("stops the session, keeps the cursor, and parks the playhead before the next slot", async () => {
    load([createLine({ id: "l0", text: "a b" }), createLine({ id: "l1", text: "c d" })]);
    const screen = await render(<SyncPanel />);
    await tapAt(50);
    await tapAt(51);
    // Registered after the taps so they read the store clock, not the idle element's.
    const element = new Audio();
    useAudioStore.getState().registerAudioElement(element);
    useAudioStore.setState({ isPlaying: false });
    await settle();
    element.dispatchEvent(new Event("ended"));
    await settle();
    expect(useAudioStore.getState().currentTime).toBeCloseTo(51 - 1.5);
    await expect.element(screen.getByRole("button", { name: /start/i })).toBeVisible();
    key({ key: " ", code: "Space" });
    await settle();
    await tapAt(52);
    expect(wordTexts(1)).toEqual(["c "]);
  });
});

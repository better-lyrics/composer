import type { WordSelection } from "@/domain/selection/model";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { installUtilitiesUsedIn } from "@/test/browser-css";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { TimelinePanel } from "@/views/timeline/timeline-panel";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Fixtures -----------------------------------------------------------------

const ROW_HEIGHT = 44;
const ZOOM = 30;

let utilities: HTMLStyleElement | null = null;

beforeEach(() => {
  const file = createAudioFile("silence.wav", 30);
  useAudioStore.setState({
    source: { type: "file", file },
    duration: 30,
    audioElement: new Audio(URL.createObjectURL(file)),
  });
  useTimelineStore.setState({ zoom: ZOOM, defaultRowHeight: ROW_HEIGHT, rowHeights: {} });
  useProjectStore.setState({
    activeTab: "timeline",
    lines: [
      createLine({
        id: "l0",
        text: "a a",
        words: [
          { text: "a ", begin: 3, end: 4 },
          { text: "a", begin: 4, end: 5 },
        ],
      }),
      createLine({
        id: "l1",
        text: "b b",
        words: [
          { text: "b ", begin: 8, end: 9 },
          { text: "b", begin: 9, end: 10 },
        ],
        backgroundText: "oh",
        backgroundWords: [{ text: "oh", begin: 8, end: 9 }],
      }),
    ],
  });
});

afterEach(() => {
  utilities?.remove();
  utilities = null;
});

async function renderTimeline() {
  const screen = await render(<TimelinePanel />);
  await expect.poll(() => document.querySelectorAll("[data-word-block]").length).toBe(5);
  utilities = await installUtilitiesUsedIn(document.body);
  await expect
    .poll(() => document.querySelector<HTMLElement>("[data-waveform-fade]")?.style.opacity, { timeout: 5000 })
    .toBe("1");
  return screen;
}

function track(lineIndex: number, type: "word" | "bg"): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-line-index="${lineIndex}"][data-track="${type}"]`);
  if (!el) throw new Error(`no ${type} track for line ${lineIndex}`);
  return el;
}

function row(lineIndex: number): HTMLElement {
  const el = track(lineIndex, "word").closest<HTMLElement>("[data-timeline-row]");
  if (!el) throw new Error(`no row for line ${lineIndex}`);
  return el;
}

async function dragWithin(element: HTMLElement, fromX: number, toX: number, fromY: number, toY = fromY) {
  await userEvent.dragAndDrop(element, element, {
    sourcePosition: { x: fromX, y: fromY },
    targetPosition: { x: toX, y: toY },
  });
}

const selected = () => useTimelineStore.getState().selectedWords;
const words = (lineId: string, lineIndex: number, type: "word" | "bg", indices: number[]): WordSelection[] =>
  indices.map((wordIndex) => ({ lineId, lineIndex, wordIndex, type }));

// -- Tests --------------------------------------------------------------------

describe("TimelinePanel · marquee", () => {
  it("keeps the words a drag inside one track selects", async () => {
    await renderTimeline();

    await dragWithin(track(0, "word"), 2.5 * ZOOM, 5.5 * ZOOM, 18, 26);

    expect(selected()).toEqual(words("l0", 0, "word", [0, 1]));
  });

  it("keeps the background words a drag inside the background track selects", async () => {
    await renderTimeline();

    await dragWithin(track(1, "bg"), 7.5 * ZOOM, 9.5 * ZOOM, 18, 26);

    expect(selected()).toEqual(words("l1", 1, "bg", [0]));
  });

  it("selects across rows when the drag crosses a row edge", async () => {
    await renderTimeline();
    const first = track(0, "word").getBoundingClientRect();
    const second = track(1, "word").getBoundingClientRect();

    await dragWithin(track(0, "word"), 2.5 * ZOOM, 9.5 * ZOOM, 18, second.top - first.top + 18);

    expect(selected()).toEqual([...words("l0", 0, "word", [0, 1]), ...words("l1", 1, "word", [0, 1])]);
  });

  describe("regressions", () => {
    it("regression #286: a drag that starts and ends in one track is not undone by the click that follows", async () => {
      await renderTimeline();

      await dragWithin(track(1, "word"), 7.5 * ZOOM, 8.5 * ZOOM, 20, 22);

      expect(selected()).toEqual(words("l1", 1, "word", [0]));
    });

    it("regression #287: resizing a row does not start a marquee", async () => {
      await renderTimeline();
      useTimelineStore.getState().setSelectedWords(words("l1", 1, "word", [1]));
      const firstRow = row(0);

      await userEvent.dragAndDrop(firstRow, row(1), {
        sourcePosition: { x: 4 * ZOOM, y: firstRow.getBoundingClientRect().height - 2 },
        targetPosition: { x: 8 * ZOOM, y: 20 },
      });

      expect(useTimelineStore.getState().rowHeights.l0).toBeGreaterThan(ROW_HEIGHT);
      expect(selected()).toEqual(words("l1", 1, "word", [1]));
      expect(document.querySelector(".border-dashed")).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("selects the words under the drag while the audio has not loaded yet", async () => {
      useAudioStore.setState({ source: { type: "youtube", videoId: "dQw4w9WgXcQ" }, audioElement: null });
      await render(<TimelinePanel />);
      await expect.poll(() => document.querySelectorAll("[data-word-block]").length).toBe(5);
      utilities = await installUtilitiesUsedIn(document.body);

      await dragWithin(track(0, "word"), 2.5 * ZOOM, 5.5 * ZOOM, 18, 26);

      expect(selected()).toEqual(words("l0", 0, "word", [0, 1]));
    });

    it("still clears the selection on a plain click in an empty track", async () => {
      await renderTimeline();
      useTimelineStore.getState().setSelectedWords(words("l0", 0, "word", [0]));

      await userEvent.click(track(0, "word"), { position: { x: 6.5 * ZOOM, y: 20 } });

      expect(selected()).toEqual([]);
    });

    it("lets the next plain click through after a marquee", async () => {
      await renderTimeline();
      await dragWithin(track(0, "word"), 2.5 * ZOOM, 5.5 * ZOOM, 18, 26);
      expect(selected()).toHaveLength(2);

      await userEvent.click(track(0, "word"), { position: { x: 6.5 * ZOOM, y: 20 } });

      expect(selected()).toEqual([]);
    });

    it("adds to the selection with Shift held, also inside one track", async () => {
      await renderTimeline();
      useTimelineStore.getState().setSelectedWords(words("l0", 0, "word", [0]));

      await userEvent.keyboard("{Shift>}");
      await dragWithin(track(1, "word"), 7.5 * ZOOM, 9.5 * ZOOM, 18, 26);
      await userEvent.keyboard("{/Shift}");

      expect(selected()).toEqual([...words("l0", 0, "word", [0]), ...words("l1", 1, "word", [0, 1])]);
    });
  });
});

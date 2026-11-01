import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { installStyleSheet } from "@/test/browser-css";
import { render } from "@/test/render";
import {
  DND_LINES,
  DndRows,
  installTimelineLayoutStyles,
  movePointer,
  pressWord,
  releasePointer,
  trackRect,
} from "@/test/timeline-dnd-rows";
import { resolveDropTarget } from "@/views/timeline/drag-end-resolution";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Constants -----------------------------------------------------------------

const ROW_CHROME_CSS =
  ".flex{display:flex}.flex-1{flex:1 1 0%}.shrink-0{flex-shrink:0}.w-12{width:3rem}.left-0{left:0}.right-0{right:0}.bottom-0{bottom:0}.h-1{height:4px}.z-10{z-index:10}.z-60{z-index:60}";

// -- Helpers -------------------------------------------------------------------

async function startDrag() {
  await render(<DndRows lines={DND_LINES} />);
  pressWord("alpha");
  await expect.poll(() => document.querySelector(".pointer-events-none [data-word-block]")).not.toBeNull();
}

function hover() {
  return useTimelineStore.getState().wordDragHover;
}

function rowElement(lineIndex: number): HTMLElement {
  const row = document.querySelectorAll<HTMLElement>("[data-timeline-row]")[lineIndex];
  if (!row) throw new Error(`no row for line ${lineIndex}`);
  return row;
}

function expectHoverMatchesDropAroundEveryBgZone() {
  for (const lineIndex of [0, 1]) {
    const bg = trackRect(lineIndex, "bg");
    for (let y = bg.top - 6; y <= bg.bottom + 6; y += 2) {
      movePointer(bg.left + 200, y);
      const drop = resolveDropTarget({ clientX: bg.left + 200, clientY: y, lines: DND_LINES });
      const current = hover();
      expect(current && { targetLineIndex: current.lineIndex, targetTrack: current.track }).toEqual(drop);
    }
  }
}

// -- Tests ---------------------------------------------------------------------

describe("useTimelineDnd hover target", () => {
  installTimelineLayoutStyles();

  beforeEach(() => {
    useAudioStore.setState({ duration: 30 });
    useTimelineStore.setState({ zoom: 100, rowHeights: {}, defaultRowHeight: 44, collapsedInstances: {} });
    useProjectStore.setState({ lines: DND_LINES });
  });

  it("reports the track under the pointer while dragging", async () => {
    await startDrag();
    const bg = trackRect(1, "bg");
    movePointer(bg.left + 200, bg.top + bg.height / 2);
    expect(hover()).toEqual({ lineIndex: 1, track: "bg" });
  });

  it("highlights exactly the hovered track in the rows", async () => {
    await startDrag();
    const bg = trackRect(1, "bg");
    movePointer(bg.left + 200, bg.top + bg.height / 2);
    const zone = document.querySelector("[data-line-index='1'][data-track='bg']");
    await expect.poll(() => zone?.className.includes("bg-composer-accent/20")).toBe(true);
    const otherMain = document.querySelector("[data-line-index='1'][data-track='word']");
    expect(otherMain?.className.includes("bg-composer-accent/10")).toBe(false);
  });

  it("clears the hover when the pointer leaves every track", async () => {
    await startDrag();
    movePointer(2, 2);
    expect(hover()).toBeNull();
  });

  it("clears the hover on drop", async () => {
    await startDrag();
    const bg = trackRect(1, "bg");
    movePointer(bg.left + 200, bg.top + 4);
    releasePointer(bg.left + 200, bg.top + 4);
    await expect.poll(() => hover()).toBeNull();
  });

  it("clears the hover when the drag is cancelled with Escape", async () => {
    await startDrag();
    const bg = trackRect(1, "bg");
    movePointer(bg.left + 200, bg.top + 4);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    await expect.poll(() => hover()).toBeNull();
  });

  describe("regressions", () => {
    let rowChromeStyle: HTMLStyleElement;
    beforeAll(() => {
      rowChromeStyle = installStyleSheet(ROW_CHROME_CSS);
    });
    afterAll(() => rowChromeStyle.remove());

    function expectDropAndHoverAt(x: number, y: number, expected: { lineIndex: number; track: "word" | "bg" }) {
      movePointer(x, y);
      expect(resolveDropTarget({ clientX: x, clientY: y, lines: DND_LINES })).toEqual({
        targetLineIndex: expected.lineIndex,
        targetTrack: expected.track,
      });
      expect(hover()).toEqual(expected);
    }

    it("regression: a drop over the line gutter lands on the track at that height", async () => {
      await startDrag();
      const gutter = rowElement(1).firstElementChild?.getBoundingClientRect();
      if (!gutter) throw new Error("no gutter for line 1");
      const main = trackRect(1, "word");
      const bg = trackRect(1, "bg");
      expectDropAndHoverAt(gutter.left + 2, main.top + main.height / 2, { lineIndex: 1, track: "word" });
      expectDropAndHoverAt(gutter.left + 2, bg.top + bg.height / 2, { lineIndex: 1, track: "bg" });
    });

    it("regression: a drop over the row resize strip lands on the bg track", async () => {
      await startDrag();
      const strip = rowElement(1).querySelector(":scope > [role='separator']")?.getBoundingClientRect();
      if (!strip || strip.height === 0) throw new Error("no resize strip for line 1");
      const main = trackRect(1, "word");
      expectDropAndHoverAt(main.left + 200, strip.top + strip.height / 2, { lineIndex: 1, track: "bg" });
    });
  });

  describe("invariants", () => {
    it("hovers the same track the drop resolves to at every pointer height around each BG zone", async () => {
      await startDrag();
      expectHoverMatchesDropAroundEveryBgZone();
    });

    it("holds with a resized row and a non-default row height", async () => {
      useTimelineStore.setState({ rowHeights: { l0: 80 }, defaultRowHeight: 60 });
      await startDrag();
      expectHoverMatchesDropAroundEveryBgZone();
    });
  });
});

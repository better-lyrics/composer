import { beforeEach, describe, expect, it } from "vitest";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
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

// -- Helpers -------------------------------------------------------------------

async function startDrag() {
  await render(<DndRows lines={DND_LINES} />);
  pressWord("alpha");
  await expect.poll(() => document.querySelector(".pointer-events-none [data-word-block]")).not.toBeNull();
}

function hover() {
  return useTimelineStore.getState().wordDragHover;
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

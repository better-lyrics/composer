import type { ClientRect, Modifier } from "@dnd-kit/core";
import type { Transform } from "@dnd-kit/utilities";
import { beforeEach, describe, expect, it } from "vitest";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { render } from "@/test/render";
import { DND_LINES, DndRows, installTimelineLayoutStyles, trackRect } from "@/test/timeline-dnd-rows";
import { trackSnapModifier, trackSnapOffsetY } from "@/views/timeline/drag-track-snap";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Helpers -------------------------------------------------------------------

async function renderRows() {
  await render(<DndRows lines={DND_LINES} />);
}

function sourceTop(): number {
  return trackRect(0, "word").top + 4;
}

function rectAt(top: number): ClientRect {
  return { top, left: 0, width: 60, height: 36, bottom: top + 36, right: 60 };
}

function modifierArgs(
  activatorEvent: PointerEvent,
  activeNodeRect: ClientRect,
  transform: Transform,
): Parameters<Modifier>[0] {
  return {
    activatorEvent,
    active: null,
    activeNodeRect,
    draggingNodeRect: activeNodeRect,
    containerNodeRect: null,
    over: null,
    overlayNodeRect: null,
    scrollableAncestors: [],
    scrollableAncestorRects: [],
    transform,
    windowRect: null,
  };
}

// -- Tests ---------------------------------------------------------------------

describe("trackSnapOffsetY", () => {
  installTimelineLayoutStyles();

  beforeEach(() => {
    useAudioStore.setState({ duration: 30 });
    useTimelineStore.setState({ zoom: 100, rowHeights: {}, defaultRowHeight: 44, collapsedInstances: {} });
    useProjectStore.setState({ lines: DND_LINES });
  });

  it("aligns the ghost top 4px inside the BG zone under the pointer", async () => {
    await renderRows();
    const bg = trackRect(1, "bg");
    expect(trackSnapOffsetY(bg.left + 200, bg.top + bg.height / 2, sourceTop())).toBeCloseTo(
      bg.top + 4 - sourceTop(),
      5,
    );
  });

  it("aligns to the main track under the pointer", async () => {
    await renderRows();
    const main = trackRect(1, "word");
    expect(trackSnapOffsetY(main.left + 200, main.top + 5, sourceTop())).toBeCloseTo(main.top + 4 - sourceTop(), 5);
  });

  it("returns zero offset over the source track itself", async () => {
    await renderRows();
    const main = trackRect(0, "word");
    expect(trackSnapOffsetY(main.left + 200, main.top + 20, sourceTop())).toBeCloseTo(0, 5);
  });

  it("returns null when no track is under the pointer", async () => {
    await renderRows();
    expect(trackSnapOffsetY(2, 2, 0)).toBeNull();
  });

  describe("regressions", () => {
    it("regression: keeps the ghost on the hovered track after the source is re-measured mid-drag", async () => {
      await renderRows();
      const bg = trackRect(1, "bg");
      const start = { x: bg.left + 100, y: trackRect(0, "word").top + 20 };
      const activatorEvent = new PointerEvent("pointerdown", { clientX: start.x, clientY: start.y });
      const pointer = { x: bg.left + 200, y: bg.top + bg.height / 2 };
      const transform = { x: pointer.x - start.x, y: pointer.y - start.y, scaleX: 1, scaleY: 1 };
      const startRect = rectAt(sourceTop());

      const first = trackSnapModifier(modifierArgs(activatorEvent, startRect, transform));
      const afterScroll = trackSnapModifier(modifierArgs(activatorEvent, rectAt(sourceTop() - 120), transform));

      expect(first.y).toBeCloseTo(bg.top + 4 - sourceTop(), 5);
      expect(afterScroll.y).toBeCloseTo(first.y, 5);
    });

    it("regression: a new drag measures from its own start position", async () => {
      await renderRows();
      const main = trackRect(1, "word");
      const transform = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
      const pointerAt = (y: number) => new PointerEvent("pointerdown", { clientX: main.left + 200, clientY: y });

      trackSnapModifier(modifierArgs(pointerAt(main.top + 5), rectAt(sourceTop()), transform));
      const second = trackSnapModifier(modifierArgs(pointerAt(main.top + 5), rectAt(main.top + 4), transform));

      expect(second.y).toBeCloseTo(0, 5);
    });
  });

  describe("edge cases", () => {
    it("aligns inside a resized row's main track", async () => {
      useTimelineStore.setState({ rowHeights: { l1: 80 } });
      await renderRows();
      const main = trackRect(1, "word");
      expect(main.height).toBe(80);
      expect(trackSnapOffsetY(main.left + 200, main.bottom - 2, sourceTop())).toBeCloseTo(
        main.top + 4 - sourceTop(),
        5,
      );
    });

    it("aligns with a non-default row height", async () => {
      useTimelineStore.setState({ defaultRowHeight: 60, rowHeights: {} });
      await renderRows();
      const bg = trackRect(0, "bg");
      expect(trackSnapOffsetY(bg.left + 200, bg.top + 2, sourceTop())).toBeCloseTo(bg.top + 4 - sourceTop(), 5);
    });
  });
});

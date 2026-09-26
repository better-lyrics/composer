import { beforeEach, describe, expect, it } from "vitest";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { render } from "@/test/render";
import { DND_LINES, DndRows, installTimelineLayoutStyles, trackRect } from "@/test/timeline-dnd-rows";
import { trackSnapOffsetY } from "@/views/timeline/drag-track-snap";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Helpers -------------------------------------------------------------------

async function renderRows() {
  await render(<DndRows lines={DND_LINES} />);
}

function sourceTop(): number {
  return trackRect(0, "word").top + 4;
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

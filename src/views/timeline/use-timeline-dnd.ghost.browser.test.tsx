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
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Helpers -------------------------------------------------------------------

async function dragAlphaIntoBgZoneOf(lineIndex: number) {
  await render(<DndRows lines={DND_LINES} />);
  pressWord("alpha");
  const bg = trackRect(lineIndex, "bg");
  const target = { x: bg.left + 200, y: bg.top + bg.height / 2 };
  movePointer(target.x, target.y);
  await expect.poll(() => document.querySelector(".pointer-events-none [data-word-block]")).not.toBeNull();
  releasePointer(target.x, target.y);
}

function bgWordsOf(lineId: string): string[] | undefined {
  return useProjectStore
    .getState()
    .lines.find((l) => l.id === lineId)
    ?.backgroundWords?.map((w) => w.text.trim());
}

// -- Tests ---------------------------------------------------------------------

describe("useTimelineDnd with the drag overlay under the pointer", () => {
  installTimelineLayoutStyles();

  beforeEach(() => {
    useAudioStore.setState({ duration: 30 });
    useTimelineStore.setState({ zoom: 100, rowHeights: {}, defaultRowHeight: 44, collapsedInstances: {} });
    useProjectStore.setState({ lines: DND_LINES });
  });

  it("regression: drops into the BG zone under the pointer even though the drag overlay covers it", async () => {
    await dragAlphaIntoBgZoneOf(1);
    await expect.poll(() => bgWordsOf("l1")).toEqual(["alpha"]);
  });

  it("drops into a resized row's BG zone under the pointer", async () => {
    useTimelineStore.setState({ rowHeights: { l1: 80 } });
    await dragAlphaIntoBgZoneOf(1);
    await expect.poll(() => bgWordsOf("l1")).toEqual(["alpha"]);
  });

  it("drops into the BG zone with a non-default row height", async () => {
    useTimelineStore.setState({ defaultRowHeight: 60 });
    await dragAlphaIntoBgZoneOf(1);
    await expect.poll(() => bgWordsOf("l1")).toEqual(["alpha"]);
  });
});

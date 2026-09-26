import { afterEach, describe, expect, it } from "vitest";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import {
  installTimelineLayoutStyles,
  movePointer,
  pressWord,
  releasePointer,
  trackRect,
} from "@/test/timeline-dnd-rows";
import { TimelinePanel } from "@/views/timeline/timeline-panel";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Helpers -------------------------------------------------------------------

function seedTimeline(rowHeights: Record<string, number> = {}): void {
  useAudioStore.setState({ source: { type: "file", file: createAudioFile() }, duration: 60 });
  useTimelineStore.setState({ zoom: 100, rowHeights, defaultRowHeight: 44 });
  useProjectStore.setState({
    activeTab: "timeline",
    lines: [
      createLine({ id: "line-0", text: "first", words: [createWord({ text: "first", begin: 1, end: 2 })] }),
      createLine({ id: "line-1", text: "second", words: [createWord({ text: "second", begin: 6, end: 7 })] }),
    ],
  });
}

function ghostBlock(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".pointer-events-none [data-word-block]");
}

async function renderPanelAndGrab(): Promise<void> {
  await render(
    <div style={{ height: 700, display: "flex", flexDirection: "column" }}>
      <TimelinePanel />
    </div>,
  );
  await expect.poll(() => document.querySelectorAll("[data-scroll-container] [data-word-block]").length).toBe(2);
  const container = document.querySelector<HTMLElement>("[data-scroll-container]");
  if (container) container.style.height = "500px";
  pressWord("first");
  await expect.poll(() => ghostBlock()).not.toBeNull();
}

// -- Tests ---------------------------------------------------------------------

describe("TimelinePanel drag ghost snapping", () => {
  installTimelineLayoutStyles();

  afterEach(() => releasePointer(0, 0));

  it("snaps and resizes the ghost into the BG zone under the pointer, then drops there", async () => {
    seedTimeline();
    await renderPanelAndGrab();
    const bg = trackRect(1, "bg");
    movePointer(bg.left + 400, bg.top + bg.height / 2);

    await expect.poll(() => ghostBlock()?.getBoundingClientRect().height).toBeCloseTo(bg.height - 8, 0);
    expect(ghostBlock()?.getBoundingClientRect().top).toBeCloseTo(bg.top + 4, 0);

    releasePointer(bg.left + 400, bg.top + bg.height / 2);
    await expect
      .poll(() =>
        useProjectStore
          .getState()
          .lines.find((l) => l.id === "line-1")
          ?.backgroundWords?.map((w) => w.text.trim()),
      )
      .toEqual(["first"]);
  });

  it("sizes the ghost to a resized row's main track", async () => {
    seedTimeline({ "line-1": 80 });
    await renderPanelAndGrab();
    const main = trackRect(1, "word");
    expect(main.height).toBe(80);
    movePointer(main.left + 400, main.top + 60);

    await expect.poll(() => ghostBlock()?.getBoundingClientRect().height).toBeCloseTo(72, 0);
    expect(ghostBlock()?.getBoundingClientRect().top).toBeCloseTo(main.top + 4, 0);
  });

  it("keeps the ghost unsnapped at its source height when no track is under the pointer", async () => {
    seedTimeline();
    await renderPanelAndGrab();
    movePointer(2, 2);

    await expect.poll(() => useTimelineStore.getState().wordDragHover).toBeNull();
    expect(ghostBlock()?.getBoundingClientRect().height).toBeCloseTo(44 - 8, 0);
  });
});

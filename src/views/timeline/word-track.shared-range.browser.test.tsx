import { describe, expect, it } from "vitest";
import type { WordTiming } from "@/domain/word/timing";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { WordTrack } from "@/views/timeline/word-track";

// -- Helpers ------------------------------------------------------------------

const GESTURE_START_X = 200;

const chorus = (id: string, instanceIdx: number, begin: number) =>
  createLine({
    id,
    text: "go now",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [
      createWord({ text: "go ", begin, end: begin + 1 }),
      createWord({ text: "now", begin: begin + 1, end: begin + 2 }),
    ],
  });

async function renderSharedTrack(sharesTiming: boolean) {
  const calls: Partial<WordTiming>[] = [];
  useTimelineStore.setState({ rollingEditMode: false, zoom: 100 });
  const source = chorus("c1", 1, 10);
  useProjectStore.setState({
    lines: [chorus("c0", 0, 3), source, chorus("c2", 2, 16)],
    groups: [createGroup({ id: "g1", ...(sharesTiming ? { sharesTiming: true } : {}) })],
  });
  const screen = await render(
    <WordTrack
      lineId={source.id}
      lineIndex={1}
      words={source.words ?? []}
      color="#a3c9ff"
      trackType="word"
      duration={20}
      height={32}
      onUpdateWord={(_index, updates) => calls.push(updates)}
    />,
    { dndContext: true },
  );
  return { blocks: Array.from(screen.container.querySelectorAll<HTMLElement>("[data-word-block]")), calls };
}

function dragEdgeBy(block: HTMLElement, edge: "left" | "right", offsetPx: number) {
  const handle = block.querySelector<HTMLElement>(`[data-edge="${edge}"]`);
  if (!handle) throw new Error(`word block has no ${edge} edge handle`);
  handle.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: GESTURE_START_X }));
  document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: GESTURE_START_X + offsetPx }));
  document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
}

// -- Tests --------------------------------------------------------------------

describe("WordTrack boundary drag in a shared group", () => {
  it("stops a first word begin where the earliest instance reaches zero", async () => {
    const { blocks, calls } = await renderSharedTrack(true);

    dragEdgeBy(blocks[0], "left", -900);

    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].begin).toBe(7);
  });

  it("stops a last word end where the latest instance reaches the song end", async () => {
    const { blocks, calls } = await renderSharedTrack(true);

    dragEdgeBy(blocks[1], "right", 900);

    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].end).toBe(14);
  });

  describe("regressions", () => {
    it("regression: a line of an old group still stops at zero and the song end", async () => {
      const { blocks, calls } = await renderSharedTrack(false);

      dragEdgeBy(blocks[0], "left", -1500);
      dragEdgeBy(blocks[1], "right", 1500);

      await expect.poll(() => calls.length).toBe(2);
      expect(calls[0].begin).toBe(0);
      expect(calls[1].end).toBe(20);
    });
  });
});

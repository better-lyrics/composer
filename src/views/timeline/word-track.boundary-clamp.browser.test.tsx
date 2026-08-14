import { describe, expect, it } from "vitest";
import type { WordTiming } from "@/domain/word/timing";
import { useProjectStore } from "@/stores/project";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { WordTrack } from "@/views/timeline/word-track";

// -- Helpers ------------------------------------------------------------------

interface ResizeCall {
  index: number;
  updates: Partial<WordTiming>;
  adjacentIndex?: number;
  adjacentUpdates?: Partial<WordTiming>;
}

const GESTURE_START_X = 200;

// A flush pair whose combined span is shorter than twice the minimum word
// duration, so no boundary position can satisfy both words' floors.
const TIGHT_PAIR = [createWord({ text: "a ", begin: 0.99, end: 1 }), createWord({ text: "b", begin: 1, end: 1.02 })];
const ROOMY_PAIR = [createWord({ text: "a ", begin: 0, end: 1 }), createWord({ text: "b", begin: 1, end: 2 })];

async function renderResizableTrack(words: WordTiming[], options: { rolling?: boolean; duration?: number } = {}) {
  const { rolling = true, duration = 3 } = options;
  const calls: ResizeCall[] = [];
  useTimelineStore.setState({ rollingEditMode: rolling, zoom: 100 });
  const line = createLine({ words });
  useProjectStore.setState({ lines: [line] });
  const screen = await render(
    <WordTrack
      lineId={line.id}
      lineIndex={0}
      words={words}
      color="#a3c9ff"
      trackType="word"
      duration={duration}
      height={32}
      onUpdateWord={(index, updates, adjacentIndex, adjacentUpdates) =>
        calls.push({ index, updates, adjacentIndex, adjacentUpdates })
      }
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

// The clamp arithmetic itself lives in domain/word/boundary.test.ts. These cover
// the inputs only the drag gesture can supply.
describe("WordTrack boundary drag inputs", () => {
  describe("regressions", () => {
    it("regression: does not invert either word when dragging the left edge of a tight flush pair", async () => {
      const { blocks, calls } = await renderResizableTrack(TIGHT_PAIR);

      dragEdgeBy(blocks[1], "left", 30);

      await expect.poll(() => calls.length).toBe(1);
      expect(calls[0].adjacentIndex).toBe(0);
      const boundary = calls[0].updates.begin ?? Number.NaN;
      expect(boundary).toBeLessThanOrEqual(TIGHT_PAIR[1].end);
      expect(boundary).toBeGreaterThanOrEqual(TIGHT_PAIR[0].begin);
      expect(calls[0].adjacentUpdates?.end).toBe(boundary);
    });

    it("regression: does not invert the last word when the audio ends before it begins", async () => {
      const { blocks, calls } = await renderResizableTrack(ROOMY_PAIR, { duration: 0.5 });

      dragEdgeBy(blocks[1], "right", -30);

      await expect.poll(() => calls.length).toBe(1);
      expect(calls[0].adjacentIndex).toBeUndefined();
      expect(calls[0].updates.end ?? Number.NaN).toBeGreaterThanOrEqual(ROOMY_PAIR[1].begin);
    });
  });
});

import { manualGrid } from "@/domain/tempo/grid-edits";
import type { WordTiming } from "@/domain/word/timing";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { applyWordPatch } from "@/utils/word-patch";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { WordTrack } from "@/views/timeline/word-track";
import { beforeEach, describe, expect, it } from "vitest";

// -- Constants -----------------------------------------------------------------

const ZOOM = 100;
const DURATION = 10;
const BEAT_AT = 1.5;
const MISS_PX = 4;
const START_X = 200;

// -- Helpers -------------------------------------------------------------------

function writeWordToStore(index: number, updates: Partial<WordTiming>): void {
  const line = useProjectStore.getState().lines[0];
  const words = line.words && applyWordPatch(line.words, index, updates);
  if (words) useProjectStore.getState().updateLineWithHistory(line.id, { words }, { propagateToSiblings: false });
}

function dragEndEdgeBy(offsetPx: number): void {
  const edge = document.querySelector<HTMLElement>('[data-word-block] [data-edge="right"]');
  if (!edge) throw new Error("no end edge on the word");
  edge.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: START_X }));
  edge.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: START_X }));
  document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: START_X + offsetPx }));
  document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: START_X + offsetPx }));
}

// -- Tests ---------------------------------------------------------------------

describe("beat grid snapping", () => {
  beforeEach(() => {
    useAudioStore.setState({ duration: DURATION, currentTime: 0 });
    useTimelineStore.setState({ zoom: ZOOM, scrollLeft: 0, isBypassing: false });
    useSettingsStore.setState({ timelineSnap: true, beatSnap: true, beatGridVisible: true, beatGridLines: "1" });
  });

  it("snaps a word's end edge to a nearby beat line", async () => {
    const word = createWord({ text: "hold", begin: 1, end: 1.2 });
    const line = createLine({ text: "hold", words: [word] });
    useProjectStore.setState({
      lines: [line],
      beatGrid: manualGrid({ bpm: 120, beatsPerBar: 4, anchor: 0, end: DURATION }),
    });
    await render(
      <WordTrack
        lineId={line.id}
        lineIndex={0}
        words={[word]}
        color="#a3c9ff"
        trackType="word"
        duration={DURATION}
        height={32}
        onUpdateWord={writeWordToStore}
      />,
      { dndContext: true },
    );

    dragEndEdgeBy((BEAT_AT - word.end) * ZOOM - MISS_PX);

    await expect.poll(() => useProjectStore.getState().lines[0].words?.[0].end).toBe(BEAT_AT);
  });
});

import type { WordTiming } from "@/domain/word/timing";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { WordTrack } from "@/views/timeline/word-track";
import { describe, expect, it } from "vitest";

// Proportional stretch of a multi-block selection is driven through the word
// block edge grips: the right edge of the latest selected block anchors at the
// selection start, the left edge of the earliest one anchors at its end.

const ZOOM = 100; // px per second
const START_X = 200;

interface Fixture {
  lineId: string;
  blocks: HTMLElement[];
  original: WordTiming[];
}

async function renderStretchTrack(
  words: WordTiming[],
  selected: number[],
  opts: { snap?: boolean; onUpdateWord?: () => void } = {},
) {
  const line = createLine({ words });
  useProjectStore.setState({ lines: [line] });
  useTimelineStore.setState({
    zoom: ZOOM,
    selectedWords: selected.map((wordIndex) => ({
      lineId: line.id,
      lineIndex: 0,
      wordIndex,
      type: "word" as const,
    })),
  });
  useAudioStore.setState({ duration: 60 });
  useSettingsStore.setState({
    minWordDuration: 0.1,
    timelineSnap: opts.snap === true,
    ...(opts.snap === true ? { timelineSnapThreshold: 8 } : {}),
  });

  const screen = await render(
    <WordTrack
      lineId={line.id}
      lineIndex={0}
      words={words}
      color="#a3c9ff"
      trackType="word"
      duration={60}
      height={32}
      onUpdateWord={opts.onUpdateWord ?? (() => {})}
    />,
    { dndContext: true },
  );
  const blocks = [...screen.container.querySelectorAll<HTMLElement>("[data-word-block]")];
  const fixture: Fixture = {
    lineId: line.id,
    blocks,
    original: useProjectStore.getState().lines[0].words ?? [],
  };
  return fixture;
}

function storeWords(): WordTiming[] {
  const line = useProjectStore.getState().lines[0];
  return line.words ?? [];
}

function pressEdge(block: HTMLElement, edge: "left" | "right"): void {
  const el = block.querySelector(`[data-edge="${edge}"]`) as HTMLElement;
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: START_X }));
}

function movePointer(dxPx: number): void {
  document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: START_X + dxPx }));
}

function releasePointer(dxPx: number): void {
  document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: START_X + dxPx }));
}

function dragEdge(block: HTMLElement, edge: "left" | "right", dxPx: number): void {
  pressEdge(block, edge);
  movePointer(dxPx);
  releasePointer(dxPx);
}

function pressEscape(): void {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
}

describe("WordTrack selection stretch", () => {
  it("commits a left-anchored stretch from the right edge of the last selected word", async () => {
    const words = [
      createWord({ text: "我 ", begin: 0, end: 1 }),
      createWord({ text: "爱 ", begin: 1, end: 2 }),
      createWord({ text: "你", begin: 5, end: 6 }),
    ];
    const { blocks } = await renderStretchTrack(words, [0, 1]);

    // +100px at zoom 100 → edge 2s → 3s → k = (3 - 0) / (2 - 0) = 1.5.
    dragEdge(blocks[1], "right", 100);

    const final = storeWords();
    expect(final[0].begin).toBeCloseTo(0, 5);
    expect(final[0].end).toBeCloseTo(1.5, 5);
    expect(final[1].begin).toBeCloseTo(1.5, 5);
    expect(final[1].end).toBeCloseTo(3, 5);
    expect(final[2].begin).toBeCloseTo(5, 5);
    expect(final[2].end).toBeCloseTo(6, 5);
  });

  it("previews live in the store during the drag and settles on release", async () => {
    const words = [
      createWord({ text: "我 ", begin: 0, end: 1 }),
      createWord({ text: "爱 ", begin: 1, end: 2 }),
      createWord({ text: "你", begin: 5, end: 6 }),
    ];
    const { blocks } = await renderStretchTrack(words, [0, 1]);

    pressEdge(blocks[1], "right");
    movePointer(100);
    const preview = storeWords();
    expect(preview[0].end).toBeCloseTo(1.5, 5);
    expect(preview[1].end).toBeCloseTo(3, 5);

    releasePointer(100);
    const final = storeWords();
    expect(final[0].end).toBeCloseTo(1.5, 5);
    expect(final[1].end).toBeCloseTo(3, 5);
  });

  it("commits a right-anchored stretch from the left edge of the first selected word", async () => {
    const words = [
      createWord({ text: "前 ", begin: 0, end: 1 }),
      createWord({ text: "爱 ", begin: 2, end: 3 }),
      createWord({ text: "你", begin: 3, end: 4 }),
    ];
    const { blocks } = await renderStretchTrack(words, [1, 2]);

    // -50px at zoom 100 → edge 2s → 1.5s; anchor t1 = 4 → k = (4 - 1.5) / 2 = 1.25.
    dragEdge(blocks[1], "left", -50);

    const final = storeWords();
    expect(final[0].begin).toBeCloseTo(0, 5);
    expect(final[0].end).toBeCloseTo(1, 5);
    expect(final[1].begin).toBeCloseTo(1.5, 5);
    expect(final[1].end).toBeCloseTo(2.75, 5);
    expect(final[2].begin).toBeCloseTo(2.75, 5);
    expect(final[2].end).toBeCloseTo(4, 5);
  });

  it("keeps plain resize for a single selected block (no stretch writes)", async () => {
    const words = [createWord({ text: "我 ", begin: 0, end: 1 }), createWord({ text: "爱", begin: 1, end: 2 })];
    let resizeCommitted = false;
    const { blocks, original } = await renderStretchTrack(words, [1], {
      onUpdateWord: () => {
        resizeCommitted = true;
      },
    });

    dragEdge(blocks[1], "right", 100);

    // The resize path committed through onUpdateWord; the stretch path never
    // touched the store directly.
    expect(resizeCommitted).toBe(true);
    expect(storeWords()).toEqual(original);
  });

  it("restores the snapshot when Escape cancels the drag", async () => {
    const words = [
      createWord({ text: "我 ", begin: 0, end: 1 }),
      createWord({ text: "爱 ", begin: 1, end: 2 }),
      createWord({ text: "你", begin: 5, end: 6 }),
    ];
    const { blocks, original } = await renderStretchTrack(words, [0, 1]);

    pressEdge(blocks[1], "right");
    movePointer(100);
    pressEscape();
    releasePointer(100);

    expect(storeWords()).toEqual(original);
  });

  it("commits nothing when the pointer never crosses the drag threshold", async () => {
    const words = [
      createWord({ text: "我 ", begin: 0, end: 1 }),
      createWord({ text: "爱 ", begin: 1, end: 2 }),
      createWord({ text: "你", begin: 5, end: 6 }),
    ];
    const { blocks, original } = await renderStretchTrack(words, [0, 1]);

    dragEdge(blocks[1], "right", 1);

    expect(storeWords()).toEqual(original);
  });

  it("snaps the dragged edge onto an unselected neighbour boundary when snapping is on", async () => {
    const words = [
      createWord({ text: "我 ", begin: 0, end: 1 }),
      createWord({ text: "爱", begin: 1, end: 2 }),
      createWord({ text: "远", begin: 5, end: 6 }),
    ];
    const { blocks } = await renderStretchTrack(words, [0, 1], { snap: true });

    // +295px → proposed edge 4.95s; the unselected neighbour begins at 5s,
    // 5px away (within the 8px threshold) → the edge snaps flush onto it and
    // k = (5 - 0) / (2 - 0) = 2.5.
    dragEdge(blocks[1], "right", 295);

    const final = storeWords();
    expect(final[0].begin).toBeCloseTo(0, 5);
    expect(final[0].end).toBeCloseTo(2.5, 5);
    expect(final[1].begin).toBeCloseTo(2.5, 5);
    expect(final[1].end).toBeCloseTo(5, 5);
    expect(final[2].begin).toBeCloseTo(5, 5);
  });

  it("keeps an external mid-drag lines write instead of restoring the snapshot", async () => {
    const words = [
      createWord({ text: "我 ", begin: 0, end: 1 }),
      createWord({ text: "爱 ", begin: 1, end: 2 }),
      createWord({ text: "你", begin: 5, end: 6 }),
    ];
    const { blocks } = await renderStretchTrack(words, [0, 1]);

    pressEdge(blocks[1], "right");
    movePointer(100);
    // Simulate an external writer (Ctrl+Z, import, project clear) replacing
    // lines while the drag is still in flight.
    const external = createLine({ words: [createWord({ text: "外部", begin: 0, end: 9 })] });
    useProjectStore.setState({ lines: [external] });
    releasePointer(100);

    // The gesture must abandon restore and commit — the external state wins.
    const final = storeWords();
    expect(final).toHaveLength(1);
    expect(final[0].text).toBe("外部");
    expect(final[0].begin).toBeCloseTo(0, 5);
    expect(final[0].end).toBeCloseTo(9, 5);
  });
});

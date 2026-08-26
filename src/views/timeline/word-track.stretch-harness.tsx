import type { WordTiming } from "@/domain/word/timing";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { WordTrack } from "@/views/timeline/word-track";

// Shared harness for the selection-stretch browser tests. Proportional stretch
// of a multi-block selection is driven through the word block edge grips: the
// right edge of the latest selected block anchors at the selection start, the
// left edge of the earliest one anchors at its end.

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

function gripEdge(block: HTMLElement, edge: "left" | "right"): HTMLElement | null {
  return block.querySelector<HTMLElement>(`[data-edge="${edge}"].bg-composer-accent`);
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

export { dragEdge, gripEdge, movePointer, pressEdge, pressEscape, releasePointer, renderStretchTrack, storeWords };

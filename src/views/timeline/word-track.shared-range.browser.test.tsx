import { describe, expect, it } from "vitest";
import type { WordTiming } from "@/domain/word/timing";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
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

async function renderSharedTrack(sharesTiming: boolean, selectWholeLine = false) {
  const calls: Partial<WordTiming>[] = [];
  useTimelineStore.setState({
    rollingEditMode: false,
    zoom: 100,
    selectedWords: selectWholeLine
      ? [0, 1].map((wordIndex) => ({ lineId: "c1", lineIndex: 1, wordIndex, type: "word" as const }))
      : [],
  });
  useAudioStore.setState({ duration: 20 });
  useSettingsStore.setState({ minWordDuration: 0.1, defaultWordDuration: 1 });
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
  const track = screen.container.querySelector<HTMLElement>(".relative");
  if (!track) throw new Error("word track did not render");
  return { blocks: Array.from(screen.container.querySelectorAll<HTMLElement>("[data-word-block]")), calls, track };
}

function dragEdgeBy(block: HTMLElement, edge: "left" | "right", offsetPx: number) {
  const handle = block.querySelector<HTMLElement>(`[data-edge="${edge}"]`);
  if (!handle) throw new Error(`word block has no ${edge} edge handle`);
  handle.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: GESTURE_START_X }));
  document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: GESTURE_START_X + offsetPx }));
  document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: GESTURE_START_X + offsetPx }));
}

function doubleClickAt(track: HTMLElement, time: number) {
  const rect = track.getBoundingClientRect();
  track.dispatchEvent(
    new MouseEvent("dblclick", { bubbles: true, clientX: rect.left + time * 100, clientY: rect.top + 10 }),
  );
}

const wordsOf = (id: string) => useProjectStore.getState().lines.find((line) => line.id === id)?.words ?? [];

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

  it("stops a selection stretch where the latest instance reaches the song end", async () => {
    const { blocks } = await renderSharedTrack(true, true);

    dragEdgeBy(blocks[1], "right", 900);

    await expect.poll(() => wordsOf("c1")[1]?.end).toBeCloseTo(14, 5);
    expect(wordsOf("c2")[1]?.end).toBeCloseTo(20, 5);
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

describe("WordTrack double-click insert in a shared group", () => {
  it("keeps the new word inside the range where the latest instance reaches the song end", async () => {
    const { track } = await renderSharedTrack(true);

    doubleClickAt(track, 13.9);

    await expect.poll(() => wordsOf("c1")).toHaveLength(3);
    expect(wordsOf("c1")[2]).toMatchObject({ begin: 13, end: 14 });
    expect(wordsOf("c2")[2]).toMatchObject({ begin: 19, end: 20 });
  });

  it("adds nothing when the gap after the last word lies outside the range", async () => {
    const { track } = await renderSharedTrack(true);
    useProjectStore.setState({
      lines: useProjectStore.getState().lines.map((line) => (line.id === "c2" ? chorus("c2", 2, 18) : line)),
    });

    doubleClickAt(track, 15);

    expect(wordsOf("c1")).toHaveLength(2);
    expect(wordsOf("c2")).toHaveLength(2);
  });

  describe("regressions", () => {
    it("regression: a line of an old group still places the word up to the song end", async () => {
      const { track } = await renderSharedTrack(false);

      doubleClickAt(track, 13.9);

      await expect.poll(() => wordsOf("c1")).toHaveLength(3);
      expect(wordsOf("c1")[2].begin).toBeCloseTo(13.4, 5);
      expect(wordsOf("c1")[2].end).toBeCloseTo(14.4, 5);
    });
  });
});

import type { LyricLine } from "@/domain/line/model";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { createGroup, createLine } from "@/test/factories";
import type { render } from "@/test/render";
import { setCurrentTime, setIsPlaying } from "@/test/sync-gesture-helpers";
import { expect } from "vitest";

// -- Fixtures -----------------------------------------------------------------

type Timing = "word" | "line" | "none";

function timedLine(id: string, text: string, begin: number, timing: Timing, fields: Partial<LyricLine> = {}) {
  const [first, second] = text.split(" ");
  if (timing === "none") return createLine({ id, text, ...fields });
  if (timing === "line") return createLine({ id, text, ...fields, begin, end: begin + 1 });
  return createLine({
    id,
    text,
    ...fields,
    words: [
      { text: `${first} `, begin, end: begin + 0.4 },
      { text: second, begin: begin + 0.5, end: begin + 1 },
    ],
  });
}

function chorusLine(instanceIdx: number, templateLineIdx: number, begin: number, timing: Timing) {
  const text = templateLineIdx === 0 ? "I want" : "you back";
  return timedLine(`c${instanceIdx}-${templateLineIdx}`, text, begin, timing, {
    groupId: "g1",
    instanceIdx,
    templateLineIdx,
  });
}

function song({ first = "none", second = "none", verse = "none", secondBegin = 0 } = {} as SongTiming) {
  return [
    chorusLine(0, 0, 10, first),
    chorusLine(0, 1, 11, first),
    timedLine("v1", "Walking home", 20, verse),
    chorusLine(1, 0, secondBegin, second),
    chorusLine(1, 1, secondBegin + 1, second),
    timedLine("v2", "Still here", 0, "none"),
  ];
}

interface SongTiming {
  first?: Timing;
  second?: Timing;
  verse?: Timing;
  secondBegin?: number;
}

// -- Helpers ------------------------------------------------------------------

function load(lines: LyricLine[], granularity: "line" | "word" = "word", playing = true) {
  useAudioStore.setState({
    source: { type: "file", file: createAudioFile() },
    duration: 120,
    currentTime: 0,
    isPlaying: playing,
  });
  useProjectStore.setState({
    lines,
    groups: [createGroup({ id: "g1", label: "Chorus", sharesTiming: true })],
    activeTab: "sync",
    granularity,
  });
}

function key(init: KeyboardEventInit, type: "keydown" | "keyup" = "keydown"): void {
  window.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init }));
}

function lineById(id: string): LyricLine | undefined {
  return useProjectStore.getState().lines.find((line) => line.id === id);
}

const firstBegin = (id: string) => {
  const line = lineById(id);
  return line?.words?.[0]?.begin ?? line?.begin;
};

async function tapAt(time: number, expectChange: () => unknown): Promise<void> {
  const before = expectChange();
  setCurrentTime(time);
  key({ key: " ", code: "Space" });
  await expect.poll(expectChange).not.toEqual(before);
}

async function undo(expectChange: () => unknown): Promise<void> {
  const before = expectChange();
  key({ key: "z", code: "KeyZ", metaKey: true });
  await expect.poll(expectChange).not.toEqual(before);
}

async function jumpToRow(screen: Awaited<ReturnType<typeof render>>, index: number): Promise<void> {
  setIsPlaying(false);
  const rows = () => screen.container.querySelectorAll<HTMLElement>('[role="button"][tabindex="-1"]');
  await expect.poll(() => rows().length).toBeGreaterThan(index);
  rows()[index].click();
  setIsPlaying(true);
}

// -- Exports ------------------------------------------------------------------

export { firstBegin, jumpToRow, key, lineById, load, song, tapAt, undo };

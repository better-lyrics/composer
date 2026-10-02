import type { LyricLine } from "@/domain/line/model";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { createGroup, createLine } from "@/test/factories";
import { render } from "@/test/render";
import { setCurrentTime, setIsPlaying } from "@/test/sync-gesture-helpers";
import { SyncPanel } from "@/views/sync/sync-panel";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const CHORUS_TEXT = ["go now", "stay here", "hold on"];

function chorusLine(instanceIdx: number, templateLineIdx: number, begin: number, timing: "word" | "line") {
  const text = CHORUS_TEXT[templateLineIdx];
  const [first, second] = text.split(" ");
  const membership = { groupId: "g1", instanceIdx, templateLineIdx };
  if (timing === "line")
    return createLine({ id: `c${instanceIdx}-${templateLineIdx}`, text, ...membership, begin, end: begin + 1 });
  return createLine({
    id: `c${instanceIdx}-${templateLineIdx}`,
    text,
    ...membership,
    words: [
      { text: `${first} `, begin, end: begin + 0.4 },
      { text: second, begin: begin + 0.5, end: begin + 1 },
    ],
  });
}

function placedSong(timing: "word" | "line"): LyricLine[] {
  return [
    chorusLine(0, 0, 10, timing),
    chorusLine(0, 1, 12, timing),
    chorusLine(0, 2, 14, timing),
    createLine({ id: "v1", text: "walking home" }),
    chorusLine(1, 0, 40, timing),
    chorusLine(1, 1, 42, timing),
    chorusLine(1, 2, 44, timing),
    createLine({ id: "v2", text: "still here" }),
  ];
}

// -- Helpers ------------------------------------------------------------------

function load(
  lines: LyricLine[],
  granularity: "line" | "word",
  groups = [createGroup({ id: "g1", sharesTiming: true })],
) {
  useSettingsStore.setState({ shareTimingInNewGroups: true });
  useAudioStore.setState({
    source: { type: "file", file: createAudioFile() },
    duration: 120,
    currentTime: 0,
    isPlaying: true,
  });
  useProjectStore.setState({ lines, groups, activeTab: "sync", granularity });
  useProjectStore.getState().clearHistory();
}

const lineById = (id: string) => useProjectStore.getState().lines.find((line) => line.id === id);
const firstBegin = (id: string) => {
  const line = lineById(id);
  return line?.words?.[0]?.begin ?? line?.begin;
};
const wordBegins = (id: string) => lineById(id)?.words?.map((word) => word.begin);

async function tapAt(time: number, changed: () => unknown): Promise<void> {
  const before = changed();
  setCurrentTime(time);
  window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true }));
  await expect.poll(changed).not.toEqual(before);
}

async function jumpToRow(screen: Awaited<ReturnType<typeof render>>, index: number): Promise<void> {
  setIsPlaying(false);
  const rows = () => screen.container.querySelectorAll<HTMLElement>('[role="button"][tabindex="-1"]');
  await expect.poll(() => rows().length).toBeGreaterThan(index);
  rows()[index].click();
  setIsPlaying(true);
}

// -- Tests --------------------------------------------------------------------

describe("SyncPanel · re-recording a placed shared instance", () => {
  it("regression: re-records Chorus 2 line by line from a jump, and the copy follows in Chorus 1", async () => {
    load(placedSong("line"), "line");
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 5);

    await tapAt(42.5, () => firstBegin("c1-1"));
    await tapAt(44.5, () => firstBegin("c1-2"));

    expect(firstBegin("c1-2")).toBe(44.5);
    expect(firstBegin("c0-2")).toBe(14.5);
    expect(lineById("v2")?.begin).toBeUndefined();
  });

  it("regression: re-records Chorus 2 word by word from a jump, and the copy follows in Chorus 1", async () => {
    load(placedSong("word"), "word");
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 5);

    await tapAt(42.2, () => wordBegins("c1-1"));
    await tapAt(42.8, () => wordBegins("c1-1"));
    await tapAt(44.3, () => wordBegins("c1-2"));

    expect(wordBegins("c1-1")).toEqual([42.2, 42.8]);
    expect(wordBegins("c1-2")?.[0]).toBe(44.3);
    expect(wordBegins("c0-2")?.[0]).toBeCloseTo(14.3, 6);
    expect(lineById("v2")?.words).toBeUndefined();
  });

  it("regression: skips Chorus 2 after the user jumps into it unshared, syncs part of it, and groups it", async () => {
    const plain = (id: string, text: string, begin?: number) =>
      createLine({ id, text, ...(begin === undefined ? {} : { begin, end: begin + 1 }) });
    load(
      [
        plain("one-a", "go now", 10),
        plain("one-b", "stay here", 13),
        plain("two-a", "go now"),
        plain("two-b", "stay here"),
        plain("verse", "walking home"),
      ],
      "line",
      [],
    );
    const screen = await render(<SyncPanel />);
    await jumpToRow(screen, 2);
    await tapAt(40, () => firstBegin("two-a"));

    useProjectStore.getState().groupRepeatingSections([0, 2], 2);
    expect(firstBegin("two-b")).toBe(43);

    await tapAt(44.5, () => firstBegin("verse"));
    expect(firstBegin("verse")).toBe(44.5);
    expect(firstBegin("one-b")).toBe(13);
  });
});

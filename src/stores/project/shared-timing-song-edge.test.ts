/**
 * @vitest-environment node
 */

import type { LyricLine } from "insync/line";
import { backgroundTrack, mainTrack, timedSyllables } from "insync/line-track";
import type { WordTiming } from "insync/word-timing";
import { beforeEach, describe, expect, it } from "vitest";
import { lineEditCommand } from "insync/commands/line-edits";
import { nudgeSelection } from "insync/commands/word-timing";
import { addressOf } from "insync/selection-resolve";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine } from "@/test/factories";
import { fieldUpdates } from "@/test/field-updates";

const SONG_END = 30;

const bridge = (instanceIdx: number, at: number): LyricLine[] => [
  createLine({
    id: `b${instanceIdx}-0`,
    text: "Carry away",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [
      { text: "Carry", sep: " ", begin: at, end: at + 0.6 },
      { text: "away", begin: at + 0.8, end: at + 1.3 },
    ],
  }),
  createLine({
    id: `b${instanceIdx}-1`,
    text: "Drift on",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 1,
    words: [
      { text: "Drift", sep: " ", begin: at + 1.3, end: at + 1.8 },
      { text: "on", begin: at + 1.9, end: at + 2.4 },
    ],
    backgroundText: "home",
    backgroundWords: [{ text: "home", begin: at + 2.4, end: at + 2.8 }],
  }),
];

const round = (time: number) => Math.round(time * 1e6) / 1e6;
const times = (line: LyricLine) =>
  [...timedSyllables(mainTrack(line)), ...timedSyllables(backgroundTrack(line))].map((word) => [
    round(word.begin),
    round(word.end),
  ]);
const shifted = (words: readonly WordTiming[], delta: number) =>
  words.map((word) => ({ ...word, begin: word.begin + delta, end: word.end + delta }));
const line = (id: string) => useProjectStore.getState().lines.find((candidate) => candidate.id === id) as LyricLine;

function expectInsideTheSongWithItsShape(instanceIdx: number) {
  const spans = [...times(line(`b${instanceIdx}-0`)), ...times(line(`b${instanceIdx}-1`))];
  const lengths = spans.map(([begin, end]) => +(end - begin).toFixed(6));
  expect(lengths).toEqual([0.6, 0.5, 0.5, 0.5, 0.4]);
  for (const [index, [begin, end]] of spans.entries()) {
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(end).toBeLessThanOrEqual(SONG_END + 1e-9);
    if (index > 0 && index < 4) expect(begin).toBeGreaterThanOrEqual(spans[index - 1][1] - 1e-9);
  }
}

beforeEach(() => {
  useProjectStore.getState().reset();
  useAudioStore.setState({ duration: SONG_END });
  useProjectStore.setState({
    groups: [createGroup({ id: "g1", sharesTiming: true })],
    lines: [...bridge(0, 0), ...bridge(1, 12), ...bridge(2, 27)],
    isDirtySinceHistory: true,
  });
});

describe("a shared edit that would take a copy past the song end", () => {
  it("regression: a re-recorded instance keeps every tap, and the copy with no room moves alone", () => {
    const [first, second] = [line("b0-0"), line("b0-1")];
    const recorded = [
      { id: "b0-0", updates: { words: shifted(timedSyllables(mainTrack(first)), 0.5) } },
      {
        id: "b0-1",
        updates: {
          words: shifted(timedSyllables(mainTrack(second)), 0.5),
          backgroundWords: shifted(timedSyllables(backgroundTrack(second)), 0.5),
        },
      },
    ];
    useProjectStore
      .getState()
      .commit(lineEditCommand({ command: "re-record", args: [] }, () => fieldUpdates(recorded)));

    expect(times(line("b0-0"))).toEqual([
      [0.5, 1.1],
      [1.3, 1.8],
    ]);
    expect(times(line("b0-1"))).toEqual([
      [1.8, 2.3],
      [2.4, 2.9],
      [2.9, 3.3],
    ]);
    expect(times(line("b1-0"))[0][0]).toBeCloseTo(12.5, 6);
    expectInsideTheSongWithItsShape(2);
  });

  it("a Timeline nudge moves the tapped instance by exactly the nudge it made, and every copy stays in the song", () => {
    const addresses = ["b0-0", "b0-1"].flatMap((id) => [
      ...timedSyllables(mainTrack(line(id))).map((word) => addressOf({ id }, "word", word)),
      ...timedSyllables(backgroundTrack(line(id))).map((word) => addressOf({ id }, "bg", word)),
    ]);
    let applied = Number.NaN;
    useProjectStore.getState().commit(
      nudgeSelection(addresses, 0.5, SONG_END, (nudge) => {
        applied = nudge.appliedDelta;
      }),
    );

    const moved = (begin: number, end: number) => [round(begin + applied), round(end + applied)];
    expect(times(line("b0-0"))).toEqual([moved(0, 0.6), moved(0.8, 1.3)]);
    expect(times(line("b0-1"))).toEqual([moved(1.3, 1.8), moved(1.9, 2.4), moved(2.4, 2.8)]);
    expect(times(line("b1-0"))[0][0]).toBeCloseTo(12 + applied, 6);
    expectInsideTheSongWithItsShape(2);
  });
});

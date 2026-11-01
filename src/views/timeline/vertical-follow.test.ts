import type { LyricLine } from "@/domain/line/model";
import type { WordSelection } from "@/domain/selection/model";
import { createLine } from "@/test/factories";
import { computeRowLayout } from "@/views/timeline/utils";
import { type FollowInput, createFollowMemory, followScrollTop, followStep } from "@/views/timeline/vertical-follow";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const ROW_HEIGHT = 60;
const WAVEFORM_COVER = 80;
const TALL_VIEWPORT = 600;

const verse = [
  createLine({
    id: "yeah",
    text: "yeah yeah yeah",
    words: [
      { text: "yeah ", begin: 19.0, end: 19.6 },
      { text: "yeah ", begin: 19.8, end: 20.4 },
      { text: "yeah", begin: 20.6, end: 21.1 },
    ],
  }),
  createLine({
    id: "too-hot",
    text: "Too hot for my own socks",
    words: [
      { text: "Too ", begin: 20.95, end: 21.2 },
      { text: "hot ", begin: 21.2, end: 21.6 },
      { text: "for my own socks", begin: 21.6, end: 23.0 },
    ],
  }),
  createLine({ id: "ceo", text: "I'm the CEO of punk rock", begin: 23.4, end: 25.8 }),
  createLine({ id: "labels", text: "Labels calling me every day", begin: 26.0, end: 28.4 }),
];

function layoutOf(lines: LyricLine[], collapsedInstances: Record<string, boolean> = {}) {
  return computeRowLayout({
    lines,
    rowHeights: {},
    defaultRowHeight: ROW_HEIGHT,
    collapsedInstances,
    focusedGroup: null,
    waveformHeight: WAVEFORM_COVER,
    groupHeaderHeight: 28,
  });
}

function word(lines: LyricLine[], lineId: string, wordIndex: number): WordSelection {
  return { lineId, lineIndex: lines.findIndex((line) => line.id === lineId), wordIndex, type: "word" };
}

interface PlaybackOptions {
  lines?: LyricLine[];
  selection?: WordSelection[] | null;
  viewportHeight?: number;
  collapsedInstances?: Record<string, boolean>;
}

// Plays the given times frame by frame and returns every row span the view was moved to.
function playFrames(times: number[], options: PlaybackOptions = {}) {
  const lines = options.lines ?? verse;
  const collapsedInstances = options.collapsedInstances ?? {};
  const layout = layoutOf(lines, collapsedInstances);
  const memory = createFollowMemory();
  const moves: { top: number; height: number }[] = [];
  for (const time of times) {
    const rows = followStep(memory, {
      lines,
      time,
      selection: options.selection ?? null,
      layout,
      collapsedInstances,
      viewportHeight: options.viewportHeight ?? TALL_VIEWPORT,
      coveredTop: WAVEFORM_COVER,
    });
    if (rows) moves.push({ top: rows.top, height: rows.height });
  }
  return moves;
}

function rowOf(lineId: string, lines: LyricLine[] = verse) {
  const row = layoutOf(lines).lineTops.get(lineId);
  if (!row) throw new Error(`no row for ${lineId}`);
  return { top: row.top, height: row.height };
}

// "Too" looped with the default 0.3 s lead-in on both sides: 20.65 to 21.5, twice.
const tooLoopPass = [20.65, 20.8, 20.96, 21.05, 21.12, 21.25, 21.4, 21.49];
const tooLoop = [...tooLoopPass, ...tooLoopPass];

// -- Tests --------------------------------------------------------------------

describe("followStep", () => {
  it("follows the line under the playhead during normal playback", () => {
    expect(playFrames([19.2, 20.0, 21.15, 22.0, 24.0, 27.0])).toEqual([
      rowOf("yeah"),
      rowOf("too-hot"),
      rowOf("ceo"),
      rowOf("labels"),
    ]);
  });

  it("centers a looped selection once when its rows fit", () => {
    const selection = [word(verse, "yeah", 2), word(verse, "too-hot", 0), word(verse, "too-hot", 1)];
    const yeah = rowOf("yeah");
    const tooHot = rowOf("too-hot");
    expect(playFrames(tooLoop, { selection })).toEqual([
      { top: yeah.top, height: tooHot.top + tooHot.height - yeah.top },
    ]);
  });

  it("follows each selected line when the selection is taller than the viewport", () => {
    const selection = [word(verse, "too-hot", 2), word(verse, "ceo", 0), word(verse, "labels", 0)];
    const pass = [21.3, 22.0, 23.5, 25.0, 26.5, 28.3];
    expect(playFrames([...pass, ...pass], { selection, viewportHeight: WAVEFORM_COVER + ROW_HEIGHT * 2 })).toEqual([
      rowOf("too-hot"),
      rowOf("ceo"),
      rowOf("labels"),
      rowOf("too-hot"),
      rowOf("ceo"),
      rowOf("labels"),
    ]);
  });

  describe("regressions", () => {
    it("regression: a looped word that starts before the previous line ends moves the view once", () => {
      expect(playFrames(tooLoop, { selection: [word(verse, "too-hot", 0)] })).toEqual([rowOf("too-hot")]);
    });

    it("regression: a tall selection's lead-in over an unselected line never pulls the view to it", () => {
      const selection = [word(verse, "too-hot", 0), word(verse, "ceo", 0)];
      const moves = playFrames([20.7, 21.0, 23.5, 25.9, 20.7, 21.0], {
        selection,
        viewportHeight: WAVEFORM_COVER + ROW_HEIGHT,
      });
      expect(moves).toEqual([rowOf("too-hot"), rowOf("ceo"), rowOf("too-hot")]);
    });

    it("regression: a block taller than the rows visible below the waveform is not held", () => {
      const selection = [word(verse, "yeah", 0), word(verse, "too-hot", 0), word(verse, "ceo", 0)];
      const viewportHeight = ROW_HEIGHT * 3 + WAVEFORM_COVER / 2;
      expect(playFrames([19.2, 21.3, 24.0], { selection, viewportHeight })).toEqual([
        rowOf("yeah"),
        rowOf("too-hot"),
        rowOf("ceo"),
      ]);
    });

    it("regression: a held block is checked again when the rows or the viewport change", () => {
      const selection = [word(verse, "yeah", 2), word(verse, "too-hot", 0)];
      const expanded = layoutOf(verse);
      const resized = computeRowLayout({
        lines: verse,
        rowHeights: { yeah: ROW_HEIGHT * 2 },
        defaultRowHeight: ROW_HEIGHT,
        collapsedInstances: {},
        focusedGroup: null,
        waveformHeight: WAVEFORM_COVER,
        groupHeaderHeight: 28,
      });
      const frames = [
        { layout: expanded, height: TALL_VIEWPORT },
        { layout: layoutOf(verse), height: TALL_VIEWPORT },
        { layout: expanded, height: TALL_VIEWPORT - 100 },
        { layout: resized, height: TALL_VIEWPORT - 100 },
        { layout: resized, height: WAVEFORM_COVER + ROW_HEIGHT * 2 },
      ];
      const memory = createFollowMemory();
      const moves = frames.map(({ layout, height }) =>
        followStep(memory, {
          lines: verse,
          time: 21.15,
          selection,
          layout,
          collapsedInstances: {},
          viewportHeight: height,
          coveredTop: WAVEFORM_COVER,
        }),
      );
      const blockOf = (layout: typeof expanded) => {
        const tooHot = layout.lineTops.get("too-hot");
        return tooHot && { top: WAVEFORM_COVER, height: tooHot.top + tooHot.height - WAVEFORM_COVER };
      };
      expect(moves).toEqual([
        blockOf(expanded),
        null,
        blockOf(expanded),
        blockOf(resized),
        resized.lineTops.get("too-hot"),
      ]);
    });

    it("regression: expanding the playing group moves the view from its header to the line", () => {
      const lines = [
        createLine({ id: "intro", begin: 1, end: 3 }),
        createLine({ id: "chorus-a", begin: 4, end: 6, groupId: "chorus", instanceIdx: 0 }),
      ];
      const collapsed = { "chorus:0": true };
      const memory = createFollowMemory();
      const frame = (collapsedInstances: Record<string, boolean>) =>
        followStep(memory, {
          lines,
          time: 5,
          selection: null,
          layout: layoutOf(lines, collapsedInstances),
          collapsedInstances,
          viewportHeight: TALL_VIEWPORT,
          coveredTop: WAVEFORM_COVER,
        });
      expect(frame(collapsed)).toEqual(layoutOf(lines, collapsed).headerTops.get("chorus:0"));
      expect(frame({})).toEqual(layoutOf(lines).lineTops.get("chorus-a"));
    });
  });

  describe("followScrollTop", () => {
    const input: FollowInput = {
      lines: verse,
      time: 0,
      selection: null,
      layout: layoutOf(verse),
      collapsedInstances: {},
      viewportHeight: 400,
      coveredTop: WAVEFORM_COVER,
    };

    it("centers the rows in the space below the waveform", () => {
      expect(followScrollTop({ top: 500, height: 60 }, input, 2000)).toBe(290);
    });

    it("clamps to the top and the bottom of the content", () => {
      expect(followScrollTop({ top: 90, height: 60 }, input, 2000)).toBe(0);
      expect(followScrollTop({ top: 1950, height: 40 }, input, 2000)).toBe(1600);
    });
  });

  describe("edge cases", () => {
    it("holds the view in a gap between lines", () => {
      expect(playFrames([22.5, 23.2, 23.3])).toEqual([rowOf("too-hot")]);
    });

    it("does not move before any line starts", () => {
      expect(playFrames([0, 5, 10])).toEqual([]);
    });

    it("follows a collapsed instance by its header", () => {
      const lines = [
        createLine({ id: "intro", begin: 1, end: 3 }),
        createLine({ id: "chorus-a", begin: 4, end: 6, groupId: "chorus", instanceIdx: 0 }),
        createLine({ id: "chorus-b", begin: 6, end: 8, groupId: "chorus", instanceIdx: 0 }),
      ];
      const collapsedInstances = { "chorus:0": true };
      const header = layoutOf(lines, collapsedInstances).headerTops.get("chorus:0");
      expect(playFrames([2, 5, 7], { lines, collapsedInstances })).toEqual([rowOf("intro", lines), header]);
    });
  });

  describe("invariants", () => {
    it("never moves twice for the same line", () => {
      expect(playFrames([21.3, 21.4, 21.5, 22.0, 22.9])).toEqual([rowOf("too-hot")]);
    });

    it("a new selection is followed again even when the playhead stays on the same line", () => {
      const lines = verse;
      const memory = createFollowMemory();
      const input = {
        lines,
        time: 21.3,
        layout: layoutOf(lines),
        collapsedInstances: {},
        viewportHeight: TALL_VIEWPORT,
        coveredTop: WAVEFORM_COVER,
      };
      followStep(memory, { ...input, selection: [word(lines, "too-hot", 1)] });
      expect(followStep(memory, { ...input, selection: [word(lines, "too-hot", 1)] })).toEqual(rowOf("too-hot"));
    });
  });
});

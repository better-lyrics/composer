import { describe, expect, it } from "vitest";
import { effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import type { WordSelection } from "@/domain/selection/model";
import { createLine } from "@/test/factories";
import { FOLLOW_LEAD_SECONDS, followedLineAt } from "@/views/timeline/followed-line";
import { computeRowLayout } from "@/views/timeline/utils";
import { createFollowMemory, type FollowInput, followScrollTop, followStep } from "@/views/timeline/vertical-follow";

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
  lead?: number;
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
      lead: options.lead ?? 0,
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
          lead: 0,
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
          lead: 0,
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
      lead: 0,
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
    it("follows the nearest line in a gap between lines", () => {
      const lines = [createLine({ id: "verse", begin: 10, end: 12 }), createLine({ id: "chorus", begin: 30, end: 32 })];
      expect(playFrames([12.5, 20.9, 21.1, 25], { lines })).toEqual([rowOf("verse", lines), rowOf("chorus", lines)]);
    });

    it("follows the first line before any line starts", () => {
      expect(playFrames([0, 5, 10])).toEqual([rowOf("yeah")]);
    });

    it("moves to a line the lead ahead of its start, even while the line before it still plays", () => {
      const lead = FOLLOW_LEAD_SECONDS;
      expect(playFrames([20.4, 20.95 - lead + 0.01, 22.0, 23.4 - lead + 0.01], { lead })).toEqual([
        rowOf("yeah"),
        rowOf("too-hot"),
        rowOf("ceo"),
      ]);
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
        lead: 0,
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

describe("followedLineAt", () => {
  const lines = [
    ...verse,
    createLine({ id: "untimed", text: "Hold on to the radio" }),
    createLine({ id: "ad-lib", text: "Hey hey", begin: 24.5, end: 26.2 }),
    createLine({ id: "outro", text: "Goodnight", begin: 40, end: 42 }),
  ];

  // The line whose span, opened the lead early, holds the time and started last; else the line nearest in time.
  function scanFollowedLine(time: number, lead: number, lineIds: ReadonlySet<string> | null): string | undefined {
    const timed = lines.flatMap((line) => {
      const bounds = effectiveBounds(line);
      return bounds && (!lineIds || lineIds.has(line.id)) ? [{ id: line.id, ...bounds }] : [];
    });
    const holding = timed.filter((line) => line.begin - lead <= time && time < line.end);
    if (holding.length > 0) return holding.reduce((best, line) => (line.begin > best.begin ? line : best)).id;
    const distance = (line: (typeof timed)[number]) => (line.end <= time ? time - line.end : line.begin - lead - time);
    return timed.reduce((best, line) => (distance(line) < distance(best) ? line : best)).id;
  }

  it("finds the same line as a scan, before, inside, on edges, in gaps and after every line", () => {
    const times = [
      5, 18.6, 19.0, 19.3, 20.5, 20.97, 21.1, 22.0, 23.0, 23.2, 23.4, 25.0, 25.8, 26.1, 28.4, 33, 35, 41, 50,
    ];
    for (const lineIds of [null, new Set(["too-hot", "ad-lib", "outro"])]) {
      for (const lead of [0, FOLLOW_LEAD_SECONDS]) {
        for (const time of times) {
          expect(followedLineAt(lines, time, lead, lineIds)?.id, `${time} ${lead}`).toBe(
            scanFollowedLine(time, lead, lineIds),
          );
        }
      }
    }
  });
});

import { mainTrack } from "@/domain/line/track";
import type { LyricLine } from "@/domain/line/model";
import { commitGesture } from "@/domain/sync/commit-gesture";
import { planLines, plainWindow } from "@/stores/alignment-plan";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

// Line mode tap scenarios from hubertfa-posttrain's parity fixtures
// (tests/composer_parity), which pin the behaviour hfapt/linemode.py
// transcribes and the step-1 evaluation scored. Each tap is [line, time,
// jumped]. `bounds` and `clamped` are what this code returned when the
// fixtures were recorded; `windows` are each aligned line's plain window under
// the step-1 rules, by line index.

// -- Fixtures -----------------------------------------------------------------

interface Scenario {
  name: string;
  duration: number;
  lines: number;
  taps: [number, number, boolean][];
  bounds: ([number, number] | null)[];
  clamped: (number | null)[];
  windows: Record<number, [number, number]>;
}

const SCENARIOS: Scenario[] = [
  {
    name: "consecutive",
    duration: 20,
    lines: 4,
    taps: [
      [0, 1, false],
      [1, 3.2, false],
      [2, 5, false],
      [3, 7.5, false],
    ],
    bounds: [
      [1, 3.2],
      [3.2, 5],
      [5, 7.5],
      [7.5, 7.5],
    ],
    clamped: [null, null, null, null],
    windows: { 0: [0.4, 3.35], 1: [2.6, 5.15], 2: [4.4, 7.65], 3: [6.9, 20] },
  },
  {
    name: "long silence",
    duration: 40,
    lines: 4,
    taps: [
      [0, 1, false],
      [1, 2.5, false],
      [2, 30, false],
      [3, 32, false],
    ],
    bounds: [
      [1, 2.5],
      [2.5, 30],
      [30, 32],
      [32, 32],
    ],
    clamped: [null, null, null, null],
    windows: { 0: [0.4, 2.65], 1: [1.9, 16.9], 2: [29.4, 32.15], 3: [31.4, 40] },
  },
  {
    name: "forward jump over an untimed line",
    duration: 20,
    lines: 5,
    taps: [
      [0, 1, false],
      [1, 3, false],
      [3, 10, true],
      [4, 12, false],
    ],
    bounds: [[1, 3], [3, 3], null, [10, 12], [12, 12]],
    clamped: [null, null, null, null],
    windows: { 0: [0.4, 3.15], 1: [2.4, 10.15], 3: [9.4, 12.15], 4: [11.4, 20] },
  },
  {
    name: "jump to the next line",
    duration: 20,
    lines: 3,
    taps: [
      [0, 1, false],
      [1, 4, true],
      [2, 6, false],
    ],
    bounds: [
      [1, 1],
      [4, 6],
      [6, 6],
    ],
    clamped: [null, null, null],
    windows: { 0: [0.4, 4.15], 1: [3.4, 6.15], 2: [5.4, 20] },
  },
  {
    name: "short lines and a backwards tap",
    duration: 20,
    lines: 5,
    taps: [
      [0, 5, false],
      [1, 5.4, false],
      [2, 5.3, false],
      [3, 6, false],
      [4, 6.05, false],
    ],
    bounds: [
      [5, 5.4],
      [5.4, 5.4],
      [5.4, 6],
      [6, 6.05],
      [6.05, 6.05],
    ],
    clamped: [null, null, 5.4, null, null],
    windows: { 0: [4.4, 5.55], 2: [4.8, 6.15], 3: [5.4, 6.2], 4: [5.45, 20] },
  },
  {
    name: "edges and the final line",
    duration: 20,
    lines: 3,
    taps: [
      [0, 0.1, false],
      [1, 18, false],
      [2, 19.9, false],
    ],
    bounds: [
      [0.1, 18],
      [18, 19.9],
      [19.9, 19.9],
    ],
    clamped: [null, null, null],
    windows: { 0: [0, 15], 1: [17.4, 20], 2: [19.3, 20] },
  },
];

// -- Helpers ------------------------------------------------------------------

function tapLines(scenario: Scenario) {
  let lines: LyricLine[] = Array.from({ length: scenario.lines }, (_, i) =>
    createLine({ id: `l${i}`, text: `line ${i} words here` }),
  );
  const clamped: (number | null)[] = [];
  for (const [lineIndex, time, jumped] of scenario.taps) {
    const commit = commitGesture(lines, "tap-line", {
      cursor: { lineIndex, wordIndex: 0 },
      jumped,
      time,
      defaultWordDuration: 0.3,
    });
    if (!commit) throw new Error(`tap on line ${lineIndex} wasn't committed`);
    clamped.push(commit.clampedTo);
    lines = lines.map((line) => {
      const update = commit.lineUpdates.find((u) => u.id === line.id);
      return update ? { ...line, ...update.updates } : line;
    });
  }
  return { lines, clamped };
}

// -- Tests --------------------------------------------------------------------

describe("planLines in Line mode", () => {
  it.each(SCENARIOS)("$name: plans every tapped line, ended or not, in step-1 windows", (scenario) => {
    const { lines, clamped } = tapLines(scenario);
    expect(
      lines.map((l) =>
        mainTrack(l).begin === undefined || mainTrack(l).end === undefined
          ? null
          : [mainTrack(l).begin, mainTrack(l).end],
      ),
    ).toEqual(scenario.bounds);
    expect(clamped).toEqual(scenario.clamped);

    const windows = Object.fromEntries(
      planLines(lines, undefined, false).map((plan) => {
        const { begin, end } = plainWindow(plan, scenario.duration);
        return [Number(plan.line.id.slice(1)), [Number(begin.toFixed(6)), Number(end.toFixed(6))]];
      }),
    );
    expect(windows).toEqual(scenario.windows);
  });
});

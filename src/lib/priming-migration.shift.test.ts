import { describe, expect, it } from "vitest";
import { detectedGrid } from "@/domain/tempo/beat-grid";
import type { WordTiming } from "@/domain/word/timing";
import { primingMigrationShift, shiftSavedTimings } from "@/lib/priming-migration";
import { storedProject } from "@/test/projects";

const P = 1104 / 44_100;

describe("primingMigrationShift", () => {
  const trimmed = { beforeSeconds: P, nowSeconds: 0 };
  const untrimmed = { beforeSeconds: P, nowSeconds: P };

  it("moves a project timed against the double crop later", () => {
    expect(primingMigrationShift({ primingStripped: true }, trimmed)).toBe(P);
  });

  it("regression: a project saved before #117 nets no shift", () => {
    expect(primingMigrationShift({}, trimmed)).toBe(0);
  });

  it("keeps the #117 shift where the decoder does not trim", () => {
    expect(primingMigrationShift({}, untrimmed)).toBe(-P);
    expect(primingMigrationShift({ primingStripped: true }, untrimmed)).toBe(0);
  });

  it("never shifts a corrected project", () => {
    expect(primingMigrationShift({ primingCorrected: true }, trimmed)).toBe(0);
    expect(primingMigrationShift({ primingCorrected: true }, untrimmed)).toBe(0);
  });

  it("regression: moves by what the old build cut, not by the newly parsed delay", () => {
    expect(primingMigrationShift({ primingStripped: true }, { beforeSeconds: 528 / 44_100, nowSeconds: 0 })).toBe(
      528 / 44_100,
    );
  });
});

describe("shiftSavedTimings", () => {
  it("moves every saved time", () => {
    const project = storedProject({
      lines: [
        { id: "L1", text: "a", agentId: "a", begin: 1, end: 2 },
        {
          id: "L2",
          text: "b",
          agentId: "a",
          words: [{ text: "b", begin: 3, end: 4 }],
          backgroundText: "c",
          backgroundWords: [{ text: "c", begin: 3.2, end: 3.8 }],
        },
      ],
      customSnapPoints: [{ id: "m", time: 5 }, 6],
      beatGrid: detectedGrid({ beats: [1, 1.5, 2, 2.5], downbeats: [1] }),
    });

    shiftSavedTimings(project, P);

    const line = project.lines[0] as { begin: number; end: number };
    const word = project.lines[1] as { words: WordTiming[]; backgroundWords: WordTiming[] };
    expect(line.begin).toBeCloseTo(1 + P, 9);
    expect(line.end).toBeCloseTo(2 + P, 9);
    expect(word.words[0].begin).toBeCloseTo(3 + P, 9);
    expect(word.backgroundWords[0].begin).toBeCloseTo(3.2 + P, 9);
    expect(project.customSnapPoints?.map((point) => (typeof point === "number" ? point : point.time))).toEqual([
      expect.closeTo(5 + P, 9),
      expect.closeTo(6 + P, 9),
    ]);
    expect((project.beatGrid as { beats: number[] }).beats[0]).toBeCloseTo(1 + P, 9);
  });

  it("is a no-op for a zero shift", () => {
    const project = storedProject();
    const before = structuredClone(project);
    shiftSavedTimings(project, 0);
    expect(project).toEqual(before);
  });
});

import { describe, expect, it } from "vitest";
import { detectedGrid, roundBeatTime } from "@/domain/tempo/beat-grid";
import { regularBeats } from "@/domain/tempo/regular-beats";
import { tempoSections } from "@/domain/tempo/tempo-sections";
import detections from "@/domain/tempo/test-fixtures/detected-beats.json";

function evenBeats(from: number, bpm: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => roundBeatTime(from + (60 / bpm) * i));
}

function gridOf(beats: number[]) {
  return detectedGrid({ beats, downbeats: beats.filter((_, i) => i % 4 === 0) });
}

const slow = evenBeats(0.5, 90, 64);
const switchGrid = gridOf([...slow, ...evenBeats(slow[63] + 60 / 128, 128, 64)]);

describe("tempoSections", () => {
  it("reads one section for a steady song", () => {
    const sections = tempoSections(gridOf(regularBeats(detections.steady).beats));
    expect(sections).toHaveLength(1);
  });

  it("splits a song where the tempo switches", () => {
    const sections = tempoSections(switchGrid);
    expect(sections.map((section) => Math.round(section.bpm))).toEqual([90, 128]);
    expect(sections[1].from).toBe(63);
  });

  it("reads a gradual speed up as one section", () => {
    const beats = [0];
    for (let i = 1; i < 128; i++) beats.push(roundBeatTime(beats[i - 1] + 60 / (100 + (10 * i) / 128)));
    expect(tempoSections(gridOf(regularBeats({ beats, downbeats: [] }).beats))).toHaveLength(1);
  });
});

describe("edge cases", () => {
  it("has no sections without beats to measure", () => {
    expect(tempoSections(gridOf([]))).toEqual([]);
    expect(tempoSections(gridOf([1]))).toEqual([]);
  });
});

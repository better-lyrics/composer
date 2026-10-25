import { describe, expect, it } from "vitest";
import { detectedGrid } from "@/domain/tempo/beat-grid";
import { manualGrid, withOffset } from "@/domain/tempo/grid-edits";
import { readBeatGrid } from "@/domain/tempo/read-beat-grid";

const beats = [0.5, 1, 1.5, 2, 2.5];
const grid = withOffset(detectedGrid({ beats, downbeats: [0.5, 2.5] }), 20);
const manual = manualGrid({ bpm: 120, beatsPerBar: 4, anchor: 1, end: 10 });

describe("readBeatGrid", () => {
  it("reads back a saved detected grid and a saved manual grid", () => {
    expect(readBeatGrid(JSON.parse(JSON.stringify(grid)))).toEqual(grid);
    expect(readBeatGrid(JSON.parse(JSON.stringify(manual)))).toEqual(manual);
  });

  it("reads a missing grid as no grid", () => {
    expect(readBeatGrid(undefined)).toBeNull();
    expect(readBeatGrid(null)).toBeNull();
  });
});

describe("error paths", () => {
  const broken: Array<[string, unknown]> = [
    ["not an object", "grid"],
    ["unknown source", { ...grid, source: "guessed" }],
    ["beats out of order", { ...grid, beats: [1, 0.5] }],
    ["a beat that is not a number", { ...grid, beats: [0.5, "1"] }],
    ["a negative beat", { ...grid, beats: [-1, 1] }],
    ["a downbeat past the last beat", { ...grid, downbeatIndices: [0, 5] }],
    ["downbeats out of order", { ...grid, downbeatIndices: [4, 0] }],
    ["a fractional downbeat index", { ...grid, downbeatIndices: [0.5] }],
    ["beats per bar out of range", { ...grid, beatsPerBar: 0 }],
    ["an offset out of range", { ...grid, offsetMs: 500 }],
    ["a detected grid with a manual origin", { ...grid, origin: manual.origin }],
    ["a manual grid with a detected origin", { ...manual, origin: grid.origin }],
    ["a manual origin with an invalid tempo", { ...manual, origin: { ...manual.origin, bpm: 0 } }],
    ["a manual origin without an end", { ...manual, origin: { bpm: 120, beatsPerBar: 4, anchor: 1 } }],
    ["a tempo scale that is not a power of two", { ...grid, tempoScale: 3 }],
    ["a detected origin with bad beats", { ...grid, origin: { beats: [2, 1], downbeats: [] } }],
  ];

  it.each(broken)("rejects %s", (_, value) => {
    expect(readBeatGrid(value)).toBeNull();
  });
});

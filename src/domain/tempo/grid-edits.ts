import { type BeatGrid, type ManualTempo, beatIndexAt, detectedGrid } from "@/domain/tempo/beat-grid";
import { MIN_BPM } from "@/domain/tempo/tap-tempo";
import { tempoStats } from "@/domain/tempo/tempo-stats";

// -- Constants -----------------------------------------------------------------

const MAX_OFFSET_MS = 200;
const BAR_ONE_LOOK_AHEAD_SECONDS = 0.15;
const MAX_DOUBLED_BPM = 240;

// -- Helpers -------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function barsFrom(anchorIndex: number, beatCount: number, beatsPerBar: number): number[] {
  const indices: number[] = [];
  for (let k = 0; k < beatCount; k++) {
    if ((((k - anchorIndex) % beatsPerBar) + beatsPerBar) % beatsPerBar === 0) indices.push(k);
  }
  return indices;
}

function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

// -- Edits ---------------------------------------------------------------------

function withOffset(grid: BeatGrid, offsetMs: number): BeatGrid {
  return { ...grid, offsetMs: Math.round(clamp(offsetMs, -MAX_OFFSET_MS, MAX_OFFSET_MS)) };
}

function withBarOneAt(grid: BeatGrid, time: number): BeatGrid {
  const last = grid.beats.length - 1;
  const index = clamp(beatIndexAt(grid, time + BAR_ONE_LOOK_AHEAD_SECONDS), 0, last);
  return { ...grid, downbeatIndices: barsFrom(index, grid.beats.length, grid.beatsPerBar) };
}

function canHalve(grid: BeatGrid): boolean {
  if (grid.beatsPerBar % 2 !== 0 || grid.beats.length < 3) return false;
  const bpm = tempoStats(halved(grid))?.bpm;
  return bpm !== undefined && bpm >= MIN_BPM;
}

function halved(grid: BeatGrid): BeatGrid {
  const parity = (grid.downbeatIndices[0] ?? 0) % 2;
  const beats = grid.beats.filter((_, i) => i % 2 === parity);
  const downbeatIndices = grid.downbeatIndices.filter((i) => i % 2 === parity).map((i) => (i - parity) / 2);
  return { ...grid, beats, downbeatIndices, beatsPerBar: grid.beatsPerBar / 2 };
}

function canDouble(grid: BeatGrid): boolean {
  const bpm = tempoStats(grid)?.bpm;
  return bpm !== undefined && bpm * 2 <= MAX_DOUBLED_BPM;
}

function doubled(grid: BeatGrid): BeatGrid {
  const beats: number[] = [];
  grid.beats.forEach((time, i) => {
    beats.push(time);
    if (i < grid.beats.length - 1) beats.push((time + grid.beats[i + 1]) / 2);
  });
  return {
    ...grid,
    beats,
    downbeatIndices: grid.downbeatIndices.map((i) => i * 2),
    beatsPerBar: grid.beatsPerBar * 2,
  };
}

// -- Manual tempo and reset ----------------------------------------------------

function manualGrid(tempo: ManualTempo, duration: number): BeatGrid {
  const step = 60 / tempo.bpm;
  const first = tempo.anchor - Math.floor(tempo.anchor / step) * step;
  const beats: number[] = [];
  for (let k = 0; first + k * step <= duration; k++) beats.push(Math.round((first + k * step) * 1000) / 1000);
  const anchorIndex = Math.round((tempo.anchor - first) / step);
  return {
    source: "manual",
    beats,
    downbeatIndices: barsFrom(anchorIndex, beats.length, tempo.beatsPerBar),
    beatsPerBar: tempo.beatsPerBar,
    offsetMs: 0,
    origin: { ...tempo },
  };
}

function resetGrid(grid: BeatGrid, duration: number): BeatGrid {
  if ("bpm" in grid.origin) return manualGrid(grid.origin, duration);
  return detectedGrid(grid.origin);
}

function isEdited(grid: BeatGrid, duration: number): boolean {
  const original = resetGrid(grid, duration);
  return (
    grid.offsetMs !== original.offsetMs ||
    grid.beatsPerBar !== original.beatsPerBar ||
    !sameNumbers(grid.beats, original.beats) ||
    !sameNumbers(grid.downbeatIndices, original.downbeatIndices)
  );
}

// -- Exports -------------------------------------------------------------------

export { canDouble, canHalve, doubled, halved, isEdited, manualGrid, resetGrid, withBarOneAt, withOffset };

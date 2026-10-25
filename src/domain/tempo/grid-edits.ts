import { type BeatGrid, type ManualTempo, beatIndexAt, detectedGrid, roundBeatTime } from "@/domain/tempo/beat-grid";
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
  const bpm = tempoStats(grid)?.bpm;
  return bpm !== undefined && grid.downbeatIndices.length >= 2 && bpm / 2 >= MIN_BPM;
}

function canDouble(grid: BeatGrid): boolean {
  const bpm = tempoStats(grid)?.bpm;
  return bpm !== undefined && bpm * 2 <= MAX_DOUBLED_BPM;
}

function nearestIndex(times: readonly number[], time: number): number {
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] < time) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 && time - times[lo - 1] < times[lo] - time ? lo - 1 : lo;
}

function originBeats(grid: BeatGrid): readonly number[] {
  return "bpm" in grid.origin ? manualGrid(grid.origin).beats : grid.origin.beats;
}

function beatsAtScale(base: readonly number[], scale: number, barTime: number): number[] {
  if (scale < 1) {
    const step = Math.round(1 / scale);
    const phase = nearestIndex(base, barTime) % step;
    return base.filter((_, i) => i % step === phase);
  }
  const beats: number[] = [];
  base.forEach((time, i) => {
    beats.push(time);
    if (i === base.length - 1) return;
    for (let part = 1; part < scale; part++) beats.push(time + ((base[i + 1] - time) * part) / scale);
  });
  return beats;
}

function rescaled(grid: BeatGrid, scale: number, barTimes: readonly number[]): BeatGrid {
  const beats = beatsAtScale(originBeats(grid), scale, barTimes[0] ?? 0);
  const downbeatIndices = [...new Set(barTimes.map((time) => nearestIndex(beats, time)))];
  return { ...grid, beats, downbeatIndices, tempoScale: scale };
}

function halved(grid: BeatGrid): BeatGrid {
  const barTimes = grid.downbeatIndices.filter((_, i) => i % 2 === 0).map((i) => grid.beats[i]);
  return rescaled(grid, grid.tempoScale / 2, barTimes);
}

function doubled(grid: BeatGrid): BeatGrid {
  const twice = rescaled(
    grid,
    grid.tempoScale * 2,
    grid.downbeatIndices.map((i) => grid.beats[i]),
  );
  const downbeatIndices = twice.downbeatIndices.flatMap((index, i) => {
    const middle = index + grid.beatsPerBar;
    return middle < (twice.downbeatIndices[i + 1] ?? twice.beats.length) ? [index, middle] : [index];
  });
  return { ...twice, downbeatIndices };
}

// -- Manual tempo and reset ----------------------------------------------------

function manualGrid(tempo: ManualTempo): BeatGrid {
  const step = 60 / tempo.bpm;
  const first = tempo.anchor - Math.floor(tempo.anchor / step) * step;
  const beats: number[] = [];
  for (let k = 0; first + k * step <= tempo.end; k++) beats.push(roundBeatTime(first + k * step));
  const anchorIndex = Math.round((tempo.anchor - first) / step);
  return {
    source: "manual",
    beats,
    downbeatIndices: barsFrom(anchorIndex, beats.length, tempo.beatsPerBar),
    beatsPerBar: tempo.beatsPerBar,
    offsetMs: 0,
    tempoScale: 1,
    origin: { ...tempo },
  };
}

function resetGrid(grid: BeatGrid): BeatGrid {
  if ("bpm" in grid.origin) return manualGrid(grid.origin);
  return detectedGrid(grid.origin);
}

function isEdited(grid: BeatGrid): boolean {
  const original = resetGrid(grid);
  return (
    grid.offsetMs !== original.offsetMs ||
    grid.beatsPerBar !== original.beatsPerBar ||
    !sameNumbers(grid.beats, original.beats) ||
    !sameNumbers(grid.downbeatIndices, original.downbeatIndices)
  );
}

// -- Exports -------------------------------------------------------------------

export { canDouble, canHalve, doubled, halved, isEdited, manualGrid, resetGrid, withBarOneAt, withOffset };

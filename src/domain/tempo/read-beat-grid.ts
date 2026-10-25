import type { BeatGrid, DetectedBeats, ManualTempo } from "@/domain/tempo/beat-grid";
import { isValidBpm } from "@/domain/tempo/tap-tempo";

// -- Constants -----------------------------------------------------------------

const MAX_BEATS_PER_BAR = 12;
const MAX_OFFSET_MS = 200;

// -- Helpers -------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAscendingTimes(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((v, i) => typeof v === "number" && Number.isFinite(v) && v >= 0 && (i === 0 || v > value[i - 1]))
  );
}

function isBeatsPerBar(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_BEATS_PER_BAR;
}

function readDownbeatIndices(value: unknown, beatCount: number): number[] | null {
  if (!Array.isArray(value)) return null;
  const valid = value.every((v, i) => Number.isInteger(v) && v >= 0 && v < beatCount && (i === 0 || v > value[i - 1]));
  return valid ? (value as number[]) : null;
}

function readDetectedOrigin(value: unknown): DetectedBeats | null {
  if (!isRecord(value) || !isAscendingTimes(value.beats) || !isAscendingTimes(value.downbeats)) return null;
  return { beats: value.beats, downbeats: value.downbeats };
}

function readManualOrigin(value: unknown): ManualTempo | null {
  if (!isRecord(value)) return null;
  const { bpm, beatsPerBar, anchor } = value;
  if (typeof bpm !== "number" || !isValidBpm(bpm) || !isBeatsPerBar(beatsPerBar)) return null;
  if (typeof anchor !== "number" || !Number.isFinite(anchor) || anchor < 0) return null;
  return { bpm, beatsPerBar, anchor };
}

// -- Reading -------------------------------------------------------------------

function readBeatGrid(value: unknown): BeatGrid | null {
  if (!isRecord(value) || !isAscendingTimes(value.beats) || !isBeatsPerBar(value.beatsPerBar)) return null;
  if (value.beats.length < 2) return null;
  const { source, beats, beatsPerBar, offsetMs } = value;
  const downbeatIndices = readDownbeatIndices(value.downbeatIndices, beats.length);
  if (!downbeatIndices) return null;
  if (typeof offsetMs !== "number" || !Number.isFinite(offsetMs) || Math.abs(offsetMs) > MAX_OFFSET_MS) return null;
  const fields = { beats, downbeatIndices, beatsPerBar, offsetMs };
  if (source === "detected") {
    const origin = readDetectedOrigin(value.origin);
    return origin ? { source, ...fields, origin } : null;
  }
  if (source === "manual") {
    const origin = readManualOrigin(value.origin);
    return origin ? { source, ...fields, origin } : null;
  }
  return null;
}

// -- Exports -------------------------------------------------------------------

export { readBeatGrid };

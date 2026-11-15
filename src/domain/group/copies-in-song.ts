import { retimedLine } from "@/domain/group/template-line";
import { instanceKey } from "@/domain/instance/key";
import { isLinked } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";
import { isSpanTimed, timedSyllables } from "@/domain/line/track";

// -- Helpers ------------------------------------------------------------------

function timesOf(line: LyricLine): number[] {
  return line.tracks.flatMap((track) => [
    ...(isSpanTimed(track) ? [track.begin, track.end] : []),
    ...timedSyllables(track).flatMap((syllable) => [syllable.begin, syllable.end]),
  ]);
}

// The least move that puts [first, last] inside the song; one longer than the song starts at zero.
function shiftIntoSong(first: number, last: number, songEnd: number): number {
  if (first < 0) return -first;
  if (last > songEnd) return Math.max(songEnd - last, -first);
  return 0;
}

// -- Functions ----------------------------------------------------------------

// A shared copy with no room left in the song moves, whole and alone, until it fits: its lines keep their shape and
// order, and the edit that made it never changes. A copy that moved no longer sits on the template, so it reads as an
// instance on its own timing.
function withCopiesInSong(lines: LyricLine[], copied: ReadonlySet<string>, songEnd: number): LyricLine[] {
  if (copied.size === 0) return lines;
  const indicesByInstance = new Map<string, number[]>();
  lines.forEach((line, index) => {
    if (!isLinked(line) || line.detached) return;
    const key = instanceKey(line.groupId, line.instanceIdx);
    if (copied.has(key)) indicesByInstance.set(key, [...(indicesByInstance.get(key) ?? []), index]);
  });
  let fitted = lines;
  for (const indices of indicesByInstance.values()) {
    const times = indices.flatMap((index) => timesOf(lines[index]));
    if (times.length === 0) continue;
    const shift = shiftIntoSong(Math.min(...times), Math.max(...times), songEnd);
    if (shift === 0) continue;
    if (fitted === lines) fitted = [...lines];
    for (const index of indices) fitted[index] = retimedLine(lines[index], shift);
  }
  return fitted;
}

// -- Exports ------------------------------------------------------------------

export { withCopiesInSong };

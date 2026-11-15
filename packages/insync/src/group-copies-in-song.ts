import { instanceKey } from "./instance-key";
import { isLinked } from "./instance-predicates";
import { effectiveBounds } from "./line-bounds";
import type { LyricLine } from "./line";
import { isSpanTimed, timedSyllables } from "./line-track";
import { retimedLine } from "./group-template-line";

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

// Whether a line of another instance overlaps [first, last].
function landsOnAnotherInstance(lines: readonly LyricLine[], key: string, first: number, last: number): boolean {
  return lines.some((line) => {
    if (!isLinked(line) || line.detached || instanceKey(line.groupId, line.instanceIdx) === key) return false;
    const bounds = effectiveBounds(line);
    return !!bounds && bounds.begin < last && bounds.end > first;
  });
}

// A shared copy with no room left in the song moves, whole and alone, until it fits: its lines keep their shape and
// order, and the edit that made it never changes. A copy that moved no longer sits on the template, so it reads as an
// instance on its own timing. Null when a copy would have to move onto another instance.
function withCopiesInSong(lines: LyricLine[], copied: ReadonlySet<string>, songEnd: number): LyricLine[] | null {
  if (copied.size === 0) return lines;
  const indicesByInstance = new Map<string, number[]>();
  lines.forEach((line, index) => {
    if (!isLinked(line) || line.detached) return;
    const key = instanceKey(line.groupId, line.instanceIdx);
    if (copied.has(key)) indicesByInstance.set(key, [...(indicesByInstance.get(key) ?? []), index]);
  });
  let fitted = lines;
  const moved: { key: string; first: number; last: number }[] = [];
  for (const [key, indices] of indicesByInstance) {
    const times = indices.flatMap((index) => timesOf(lines[index]));
    if (times.length === 0) continue;
    const first = Math.min(...times);
    const last = Math.max(...times);
    const shift = shiftIntoSong(first, last, songEnd);
    if (shift === 0) continue;
    if (fitted === lines) fitted = [...lines];
    for (const index of indices) fitted[index] = retimedLine(lines[index], shift);
    moved.push({ key, first: first + shift, last: last + shift });
  }
  return moved.some(({ key, first, last }) => landsOnAnotherInstance(fitted, key, first, last)) ? null : fitted;
}

// -- Exports ------------------------------------------------------------------

export { withCopiesInSong };

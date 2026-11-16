import { type CarriedTimes, inSongOrder } from "./group-carried-times";
import type { Syllable } from "./line";
import { isTimedSyllable, untimedSyllable } from "./line-track";
import { lcsPairs, wordKey } from "./word-alignment";
import { newWordId } from "./word-id";
import { msFromSeconds } from "./time";
import { textSlots } from "./word-letter-slots";
import type { WordTiming } from "./word-timing";

// -- Types --------------------------------------------------------------------

// Where a syllable of the edited instance stood before the edit, and the syllable another instance has there.
interface LineagePair {
  source: Syllable;
  target: Syllable;
}

type LineageCounterpart = (sourceId: string) => LineagePair | undefined;

// Where the instance's line has room: after the line before it ends, before the line after it starts.
interface LineRoom {
  floor: number;
  limit: number;
}

// -- Constants ----------------------------------------------------------------

const WHOLE_SONG: LineRoom = { floor: 0, limit: Number.POSITIVE_INFINITY };

// -- Helpers ------------------------------------------------------------------

// The other instance's id for a syllable it already had; a syllable the edit added gets an id of its own there.
function targetId(counterpart: LineageCounterpart, sourceId: string): string {
  return counterpart(sourceId)?.target.id ?? newWordId();
}

// Mapped times are kept to the nanosecond so a ratio taken in seconds lands on the time it names.
const tidy = (time: number) => Math.round(time * 1e9) / 1e9;

// A time inside a source span, placed at the same ratio inside the target's span.
function mappedTime(time: number, source: WordTiming, target: WordTiming): number {
  const duration = source.end - source.begin;
  const ratio =
    duration > 0 ? Math.min(1, Math.max(0, (time - source.begin) / duration)) : time <= source.begin ? 0 : 1;
  return tidy(target.begin + ratio * (target.end - target.begin));
}

function overlaps(syllable: WordTiming, span: WordTiming): boolean {
  if (span.end === span.begin) return syllable.begin <= span.begin && span.begin <= syllable.end;
  return Math.min(syllable.end, span.end) > Math.max(syllable.begin, span.begin);
}

function timedPair(pair: LineagePair | undefined): { source: WordTiming; target: WordTiming } | undefined {
  return pair && isTimedSyllable(pair.source) && isTimedSyllable(pair.target)
    ? { source: pair.source, target: pair.target }
    : undefined;
}

// The source syllables a timed syllable of the edit came from: the ones its span covers, or the one it kept the id of.
// "untimed" when the other instance has one of them untimed; null when the edit added the syllable.
function parentPairs(
  syllable: WordTiming,
  before: readonly Syllable[],
  counterpart: LineageCounterpart,
): { source: WordTiming; target: WordTiming }[] | "untimed" | null {
  const covered = before.filter((parent) => isTimedSyllable(parent) && overlaps(parent, syllable));
  const parents = covered.length > 0 ? covered : [counterpart(syllable.id)?.source].flatMap((s) => s ?? []);
  if (parents.length === 0) return null;
  const pairs = parents.map((parent) => timedPair(counterpart(parent.id)));
  return pairs.every((pair) => pair !== undefined) ? pairs : "untimed";
}

function carriedTimes(syllable: Syllable, before: readonly Syllable[], counterpart: LineageCounterpart): CarriedTimes {
  if (!isTimedSyllable(syllable)) return "untimed";
  const own = counterpart(syllable.id);
  if (own && isTimedSyllable(own.source) && own.source.begin === syllable.begin && own.source.end === syllable.end) {
    return isTimedSyllable(own.target) ? [own.target.begin, own.target.end] : "untimed";
  }
  const parents = parentPairs(syllable, before, counterpart);
  if (!parents || parents === "untimed") return parents;
  const first = parents[0];
  const last = parents[parents.length - 1];
  return [mappedTime(syllable.begin, first.source, first.target), mappedTime(syllable.end, last.source, last.target)];
}

// -- Functions ----------------------------------------------------------------

// The syllables under the other instance's ids and times; once one is untimed, every one after it is too.
function withTimes(
  after: readonly Syllable[],
  times: readonly CarriedTimes[],
  idOf: (syllable: Syllable, index: number) => string,
): Syllable[] {
  let timedRun = true;
  return after.map((syllable, index) => {
    const id = idOf(syllable, index);
    const span = timedRun ? times[index] : "untimed";
    if (!Array.isArray(span)) {
      timedRun = false;
      return { ...untimedSyllable(syllable), id };
    }
    return { ...untimedSyllable(syllable), id, begin: span[0], end: span[1] };
  });
}

// How much longer the instance's times run than the edit's, over the syllables both have.
function timeScale(after: readonly Syllable[], times: readonly CarriedTimes[]): number {
  const source = { begin: Number.POSITIVE_INFINITY, end: Number.NEGATIVE_INFINITY };
  const target = { begin: Number.POSITIVE_INFINITY, end: Number.NEGATIVE_INFINITY };
  for (const [index, syllable] of after.entries()) {
    const span = times[index];
    if (!isTimedSyllable(syllable) || !Array.isArray(span)) continue;
    source.begin = Math.min(source.begin, syllable.begin);
    source.end = Math.max(source.end, syllable.end);
    target.begin = Math.min(target.begin, span[0]);
    target.end = Math.max(target.end, span[1]);
  }
  const sourceLength = source.end - source.begin;
  const targetLength = target.end - target.begin;
  return sourceLength > 0 && targetLength > 0 ? targetLength / sourceLength : 1;
}

// Syllables the edit added before the instance's first one, at the edit's lead before it, never before `floor`. False
// when the edit gives them no times to keep.
function leadsIn(
  after: readonly Syllable[],
  filled: CarriedTimes[],
  start: number,
  end: number,
  scale: number,
  floor: number,
): boolean {
  for (let index = end; index >= start; index--) {
    const syllable = after[index];
    const later = after[index + 1];
    const reached = filled[index + 1];
    if (!isTimedSyllable(syllable) || !isTimedSyllable(later) || !Array.isArray(reached)) return false;
    const begin = Math.max(Math.min(floor, reached[0]), reached[0] - (later.begin - syllable.begin) * scale);
    const finish = Math.max(begin, reached[0] - (later.begin - syllable.end) * scale);
    filled[index] = [tidy(begin), tidy(finish)];
  }
  return true;
}

// Timed syllables the edit added with no source under them fill the gap the instance has where they sit, split evenly.
// Added before the first or after the last syllable the instance has, they keep the edit's gaps and lengths at the
// instance's scale, inside the instance's room: after the line before it ends, before the line after it starts, but never
// past the instance's syllable beside them. With no timed syllable of the instance beside them they stay untimed.
function withGapsFilled(after: readonly Syllable[], times: readonly CarriedTimes[], room: LineRoom): CarriedTimes[] {
  const { floor, limit } = room;
  const filled = [...times];
  const scale = timeScale(after, times);
  const spanAt = (index: number) => {
    const span = filled[index];
    return Array.isArray(span) ? span : undefined;
  };
  for (let start = 0; start < filled.length; start++) {
    if (filled[start] !== null) continue;
    let end = start;
    while (end + 1 < filled.length && filled[end + 1] === null) end++;
    const previous = spanAt(start - 1);
    const next = spanAt(end + 1);
    if (previous && !next) {
      for (let index = start; index <= end; index++) {
        const syllable = after[index];
        const earlier = after[index - 1];
        const reached = spanAt(index - 1);
        if (!isTimedSyllable(syllable) || !isTimedSyllable(earlier) || !reached) break;
        const ceiling = Math.max(limit, reached[1]);
        const begin = Math.min(ceiling, reached[1] + (syllable.begin - earlier.end) * scale);
        filled[index] = [tidy(begin), tidy(Math.min(ceiling, begin + (syllable.end - syllable.begin) * scale))];
      }
      start = end;
      continue;
    }
    if (!previous && next && leadsIn(after, filled, start, end, scale, floor)) {
      start = end;
      continue;
    }
    if (!previous && !next) {
      start = end;
      continue;
    }
    const from = previous?.[1] ?? Math.min(floor, next?.[0] ?? floor);
    const to = Math.max(from, next?.[0] ?? from);
    // With under a millisecond each before the next syllable, the added ones share its slot by letters, as typed words do.
    if (msFromSeconds(to) - msFromSeconds(from) <= end - start && next && from < next[1]) {
      const texts = after.slice(start, end + 2).map((syllable) => syllable.text);
      for (const [offset, slot] of textSlots(texts, from, next[1]).entries())
        filled[start + offset] = [tidy(slot.begin), tidy(slot.end)];
      start = end;
      continue;
    }
    const step = (to - from) / (end - start + 1);
    for (let index = start; index <= end; index++) {
      filled[index] = [tidy(from + (index - start) * step), tidy(from + (index - start + 1) * step)];
    }
    start = end;
  }
  return filled;
}

// The edited track as another instance has it, on that instance's own timing: kept syllables keep its times, a split
// divides its span at the edit's ratio, a merge takes the envelope of its parts, and a syllable added timed fills the
// gap it sits in, or follows the last one at the edit's spacing, up to `limit`. Kept syllables keep that instance's
// ids. Timed syllables stay ahead of untimed ones.
function syllableLineage(
  before: readonly Syllable[],
  after: readonly Syllable[],
  counterpart: LineageCounterpart,
  room: LineRoom = WHOLE_SONG,
): Syllable[] {
  const times = withGapsFilled(
    after,
    inSongOrder(
      before,
      after,
      after.map((syllable) => carriedTimes(syllable, before, counterpart)),
    ),
    room,
  );
  return withTimes(after, times, (syllable) => targetId(counterpart, syllable.id));
}

// The edited track, which holds no syllable timing of its own, on an instance whose syllables are timed: syllables with
// the same text keep that instance's times, and new ones fill the gaps between them, so a line-synced edit never
// takes word timing away from an instance that has it.
function lineageByText(
  after: readonly Syllable[],
  own: readonly Syllable[],
  counterpart: LineageCounterpart,
  splitChar: string,
  room: LineRoom = WHOLE_SONG,
): Syllable[] {
  const matched = new Map(
    lcsPairs(
      own.map((syllable) => wordKey(syllable.text, splitChar)),
      after.map((syllable) => wordKey(syllable.text, splitChar)),
    ).map(([ownIndex, afterIndex]) => [afterIndex, own[ownIndex]]),
  );
  const times = withGapsFilled(
    after,
    after.map((_, index): CarriedTimes => {
      const same = matched.get(index);
      if (!same) return null;
      return isTimedSyllable(same) ? [same.begin, same.end] : "untimed";
    }),
    room,
  );
  return withTimes(after, times, (syllable, index) => matched.get(index)?.id ?? targetId(counterpart, syllable.id));
}

// Letters only, so a merge that drops the space between two words still lines up with the words it joined.
const letterCount = (text: string) => [...text].filter((character) => character.trim() !== "").length;

// The edited track on another instance whose syllables are split differently but spell the same letters: each
// syllable's edges land where those letters sit in that instance's own syllables. Null when the letters differ or an
// edge falls on an untimed syllable.
function lineageByLetters(
  after: readonly Syllable[],
  own: readonly Syllable[],
  counterpart: LineageCounterpart,
): Syllable[] | null {
  const ownSpans: { start: number; length: number; syllable: WordTiming }[] = [];
  let letters = 0;
  for (const syllable of own) {
    const length = letterCount(syllable.text);
    if (length > 0 && isTimedSyllable(syllable)) ownSpans.push({ start: letters, length, syllable });
    letters += length;
  }
  if (after.reduce((total, syllable) => total + letterCount(syllable.text), 0) !== letters) return null;
  const timeAt = (letter: number, edge: "begin" | "end") => {
    const index = edge === "begin" ? letter : letter - 1;
    const span = ownSpans.find(({ start, length }) => index >= start && index < start + length);
    if (!span) return undefined;
    const { begin, end } = span.syllable;
    return tidy(begin + ((letter - span.start) / span.length) * (end - begin));
  };
  let start = 0;
  let timedRun = true;
  return after.map((syllable) => {
    const length = letterCount(syllable.text);
    const begin = timeAt(start, "begin");
    const end = timeAt(start + length, "end");
    start += length;
    const id = targetId(counterpart, syllable.id);
    if (!timedRun || begin === undefined || end === undefined || length === 0) {
      timedRun = false;
      return { ...untimedSyllable(syllable), id };
    }
    return { ...syllable, id, begin, end };
  });
}

// -- Exports ------------------------------------------------------------------

export type { LineageCounterpart, LineagePair, LineRoom };
export { lineageByLetters, lineageByText, syllableLineage, targetId };

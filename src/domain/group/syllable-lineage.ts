import type { Syllable } from "@/domain/line/model";
import { isTimedSyllable, untimedSyllable } from "@/domain/line/track";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

// Where a syllable of the edited instance stood before the edit, and the syllable another instance has there.
interface LineagePair {
  source: Syllable;
  target: Syllable;
}

type LineageCounterpart = (sourceId: string) => LineagePair | undefined;

// -- Helpers ------------------------------------------------------------------

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

type CarriedTimes = readonly [number, number] | "untimed" | null;

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

// Timed syllables the edit added with no source under them fill the gap the instance has where they sit, split evenly.
function withGapsFilled(times: readonly CarriedTimes[]): CarriedTimes[] {
  const filled = [...times];
  const spanAt = (index: number) => {
    const span = filled[index];
    return Array.isArray(span) ? span : undefined;
  };
  for (let start = 0; start < filled.length; start++) {
    if (filled[start] !== null) continue;
    let end = start;
    while (end + 1 < filled.length && filled[end + 1] === null) end++;
    const from = spanAt(start - 1)?.[1] ?? 0;
    const to = Math.max(from, spanAt(end + 1)?.[0] ?? from);
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
// gap it sits in. Kept syllables keep that instance's ids. Timed syllables stay ahead of untimed ones.
function syllableLineage(
  before: readonly Syllable[],
  after: readonly Syllable[],
  counterpart: LineageCounterpart,
): Syllable[] {
  const times = withGapsFilled(after.map((syllable) => carriedTimes(syllable, before, counterpart)));
  let timedRun = true;
  return after.map((syllable, index) => {
    const id = counterpart(syllable.id)?.target.id ?? syllable.id;
    const span = timedRun ? times[index] : "untimed";
    if (!Array.isArray(span)) {
      timedRun = false;
      return { ...untimedSyllable(syllable), id };
    }
    return { ...syllable, id, begin: span[0], end: span[1] };
  });
}

// Letters only, so a merge that drops the space between two words still lines up with the words it joined.
const letterCount = (text: string) => [...text].filter((character) => character.trim() !== "").length;

// The edited track on another instance whose syllables are split differently but spell the same letters: each
// syllable's edges land where those letters sit in that instance's own syllables. Null when the letters differ or an
// edge falls on an untimed syllable.
function lineageByLetters(after: readonly Syllable[], own: readonly Syllable[]): Syllable[] | null {
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
    if (!timedRun || begin === undefined || end === undefined || length === 0) {
      timedRun = false;
      return untimedSyllable(syllable);
    }
    return { ...syllable, begin, end };
  });
}

// -- Exports ------------------------------------------------------------------

export type { LineageCounterpart, LineagePair };
export { lineageByLetters, syllableLineage };

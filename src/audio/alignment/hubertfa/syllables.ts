import type { WordInterval } from "@/domain/alignment/words";

// Syllable timing for English words from the phones the model placed. A word is
// one block of phones to the model; its spelled syllables are matched to the
// sung vowels, and each boundary goes among the consonants between two vowels.
// Anything that doesn't match cleanly returns null, and the caller keeps the
// split by character count.

// -- Types --------------------------------------------------------------------

/** One decoded phone of a word, in song or window seconds. */
interface TimedPhone {
  phone: string;
  begin: number;
  end: number;
}

interface SyllableSplit {
  /** Character offsets in the word where a new syllable starts. */
  at: number[];
  intervals: WordInterval[];
}

interface Span {
  start: number;
  end: number;
}

// -- Constants ----------------------------------------------------------------

const VOWEL_PHONES = new Set([
  "aa",
  "ae",
  "ah",
  "ao",
  "aw",
  "ax",
  "ay",
  "eh",
  "er",
  "ey",
  "ih",
  "iy",
  "ow",
  "oy",
  "uh",
  "uw",
]);
const VOWEL_LETTERS = "aeiou";
// Two letters written for one consonant sound, which a syllable boundary never splits.
const DIGRAPHS = new Set(["ch", "sh", "th", "ph", "wh", "ck", "ng", "gh", "qu"]);
// Single consonant sounds that close the syllable before them ("sing|er", "rock|et").
const CODA_SOUNDS = new Set(["ck", "ng", "x"]);
/** How far a syllable boundary must move from an even split by letters before it's worth splitting the word. */
const NOTICEABLE_SECONDS = 0.1;

// -- Functions ----------------------------------------------------------------

const isLetter = (char: string | undefined) => char !== undefined && char >= "a" && char <= "z";

// "y" is a vowel unless a vowel follows it: "baby", "my", but "yes".
function isVowelAt(text: string, i: number): boolean {
  if (VOWEL_LETTERS.includes(text[i])) return true;
  const next = text[i + 1];
  return text[i] === "y" && (next === undefined || !VOWEL_LETTERS.includes(next));
}

// Runs of vowel letters, each one sung vowel, without a silent final e ("make", "little").
function vowelGroups(text: string): Span[] {
  const groups: Span[] = [];
  for (let i = 0; i < text.length; i++) {
    if (!isVowelAt(text, i)) continue;
    const last = groups[groups.length - 1];
    if (last && last.end === i) last.end = i + 1;
    else groups.push({ start: i, end: i + 1 });
  }
  const last = groups[groups.length - 1];
  const silentE = last && last.start === text.length - 1 && text.endsWith("e") && isLetter(text[last.start - 1]);
  if (silentE && groups.length > 1) groups.pop();
  return groups;
}

function vowelPhoneIndices(phones: readonly TimedPhone[]): number[] {
  return phones.flatMap((p, i) => (VOWEL_PHONES.has(p.phone) ? [i] : []));
}

function consonantLetters(text: string, from: number, to: number): number {
  let count = 0;
  for (let i = from; i < to; i++) if (isLetter(text[i]) && !isVowelAt(text, i)) count++;
  return count;
}

/** Intervals for a word's spelled syllables, or null when they don't match its sung vowels one to one. */
function syllableIntervals(parts: readonly string[], phones: readonly TimedPhone[]): WordInterval[] | null {
  const text = parts.join("").toLowerCase();
  const groups = vowelGroups(text);
  const nuclei = vowelPhoneIndices(phones);
  if (phones.length === 0 || groups.length !== nuclei.length) return null;

  const starts = parts.map((_, k) => parts.slice(0, k).join("").length);
  const groupsOf = parts.map((part, k) =>
    groups.filter((g) => g.start >= starts[k] && g.start < starts[k] + part.length),
  );
  if (groupsOf.some((g) => g.length === 0)) return null;

  const boundaries: number[] = [];
  let seen = 0;
  for (let k = 0; k < parts.length - 1; k++) {
    seen += groupsOf[k].length;
    const a = nuclei[seen - 1];
    const between = nuclei[seen] - a - 1;
    const lastGroup = groupsOf[k][groupsOf[k].length - 1];
    const coda = consonantLetters(text, lastGroup.end, starts[k + 1]);
    const onset = consonantLetters(text, starts[k + 1], groupsOf[k + 1][0].start);
    // The consonants between two vowels go to each side by how many letters each side spells.
    const toPrevious = coda + onset === 0 ? 0 : Math.round((between * coda) / (coda + onset));
    boundaries.push(phones[a + 1 + toPrevious].begin);
  }

  const begin = phones[0].begin;
  const end = phones[phones.length - 1].end;
  return parts.map((_, k) => ({ begin: boundaries[k - 1] ?? begin, end: boundaries[k] ?? end }));
}

// The letters between two vowel groups as consonant sounds, or null if anything else sits there.
function consonantSounds(between: string): string[] | null {
  const sounds: string[] = [];
  for (let i = 0; i < between.length; i++) {
    if (!isLetter(between[i])) return null;
    const pair = between.slice(i, i + 2);
    sounds.push(DIGRAPHS.has(pair) ? pair : between[i]);
    if (DIGRAPHS.has(pair)) i++;
  }
  return sounds;
}

/** Where to split an unsplit word into syllables, or null when its spelling doesn't show `vowels` syllables. */
function spellingSyllables(word: string, vowels: number): number[] | null {
  const text = word.toLowerCase();
  const groups = vowelGroups(text);
  if (vowels < 2 || groups.length !== vowels) return null;
  const at: number[] = [];
  for (let k = 0; k < groups.length - 1; k++) {
    const sounds = consonantSounds(text.slice(groups[k].end, groups[k + 1].start));
    if (!sounds) return null;
    // One consonant starts the next syllable ("ba|by") unless it closes this one ("sing|er");
    // with two or more, the first stays behind ("hel|lo", "hap|py").
    const keep = sounds.length === 0 ? 0 : sounds.length === 1 ? (CODA_SOUNDS.has(sounds[0]) ? 1 : 0) : 1;
    at.push(groups[k].end + sounds.slice(0, keep).join("").length);
  }
  return at;
}

/**
 * A split for an unsplit word, when timing its syllables from the audio moves a
 * boundary noticeably from an even split by letters, which is how the word
 * would play otherwise.
 */
function noticeableSplit(word: string, phones: readonly TimedPhone[]): SyllableSplit | null {
  const at = spellingSyllables(word, vowelPhoneIndices(phones).length);
  if (!at) return null;
  const parts = [0, ...at].map((start, k) => word.slice(start, at[k] ?? word.length));
  const intervals = syllableIntervals(parts, phones);
  if (!intervals) return null;
  const begin = phones[0].begin;
  const span = phones[phones.length - 1].end - begin;
  const moved = at.some(
    (offset, k) => Math.abs(intervals[k].end - (begin + (span * offset) / word.length)) > NOTICEABLE_SECONDS,
  );
  return moved ? { at, intervals } : null;
}

// -- Exports ------------------------------------------------------------------

export { noticeableSplit, spellingSyllables, syllableIntervals };
export type { SyllableSplit, TimedPhone };

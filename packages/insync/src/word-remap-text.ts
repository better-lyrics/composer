import { splitTrailingWhitespace } from "./from-words";
import { lcsPairs, wordKey } from "./word-alignment";
import type { WordTiming } from "./word-timing";
import { splitIntoWordsWithMeta } from "./lyric-words";
import { msFromSeconds } from "./time";
import { textSlots } from "./word-letter-slots";
import { synthesizeBracketedWord } from "./word-clone";

// -- Helpers ------------------------------------------------------------------

function tokenizeWordTexts(text: string, splitChar: string): string[] {
  const { parts, trailingSpace } = splitIntoWordsWithMeta(text, splitChar);
  return parts.map((part, i) => part + (trailingSpace[i] ? " " : ""));
}

// A bracket typed straight after a word starts a part of its own, so the word keeps its timing and the bracket can
// become a background. A part a timed word already holds whole, bracket and all, stays one part. Returns the parts and
// the indices of the parts that run into the next with no space and no split mark.
function withTypedGroupsApart(
  texts: readonly string[],
  oldWords: readonly WordTiming[],
  splitChar: string,
): { texts: string[]; glued: ReadonlySet<number> } {
  const oldKeys = new Set(oldWords.map((word) => wordKey(word.text, splitChar)));
  const parts: string[] = [];
  const glued = new Set<number>();
  for (const text of texts) {
    const open = text.indexOf("(", 1);
    if (open < 1 || oldKeys.has(wordKey(text, splitChar))) {
      parts.push(text);
      continue;
    }
    glued.add(parts.length);
    parts.push(text.slice(0, open), text.slice(open));
  }
  return { texts: parts, glued };
}

// A boundary the edit left alone keeps its join (a word can end without a space); elsewhere the typed
// text decides: a part runs into the next one unless a space ends it.
function joinedToTypedText(
  words: WordTiming[],
  texts: readonly string[],
  oldWords: readonly WordTiming[],
  oldIndexOf: readonly (number | undefined)[],
  glued: ReadonlySet<number>,
): WordTiming[] {
  return words.map((word, i) => {
    const old = oldIndexOf[i];
    const untouched = old !== undefined && oldIndexOf[i + 1] === old + 1 && oldWords[old].sep === word.sep;
    // A word end the text never shows, on a word the edit retyped, takes the split mark the typed text has there.
    const hidden = old !== undefined && oldWords[old].sep === "" && !oldWords[old].joinsNext;
    if (untouched && !(hidden && oldWords[old].text !== word.text)) return word;
    return { ...word, joinsNext: i < texts.length - 1 && !texts[i].endsWith(" ") && !glued.has(i) };
  });
}

function spreadEvenly(texts: string[], begin: number, end: number) {
  const step = (end - begin) / texts.length;
  return texts.map((text, k) => ({ text, begin: begin + step * k, end: begin + step * (k + 1) }));
}

interface Delay {
  // The first word that moves later, the first shared word, and the first typed word of the run.
  from: number;
  start: number;
  run: number;
  ms: number;
}

interface LimitedWords {
  words: WordTiming[];
  // Words from here on are left untimed: the line had no room for them before its limit.
  untimedFrom: number;
}

interface SharedSlots {
  slots: Map<number, { begin: number; end: number }>;
  // Milliseconds everything after the shared words moves later, when even all of them had no time to give.
  delay: Delay | null;
}

// The fewest kept words next to a typed run whose time, with the run's slot, gives every word a millisecond: first the
// words after it, then the words before it. Slots by text index. Where all the kept words around it have no time to
// give, the last of them ends that many milliseconds later and every word after it moves with it, so no word is ever
// under a millisecond.
function sharedSlots(
  texts: readonly string[],
  oldIndexOf: readonly (number | undefined)[],
  oldWords: readonly WordTiming[],
  slot: { begin: number; end: number },
  runStart: number,
  runEnd: number,
): SharedSlots {
  let from = runStart;
  let to = runEnd;
  const kept = (index: number) => oldIndexOf[index] !== undefined;
  const beginAt = (index: number) => (index === runStart ? slot.begin : oldWords[oldIndexOf[index] as number].begin);
  const endAt = (index: number) => (index === runEnd - 1 ? slot.end : oldWords[oldIndexOf[index] as number].end);
  const byIndex = (slots: readonly { begin: number; end: number }[]) =>
    new Map(slots.map((shared, index) => [from + index, shared]));
  while (to < texts.length && kept(to)) {
    to++;
    const slots = textSlots(texts.slice(from, to), beginAt(from), endAt(to - 1));
    if (slots) return { slots: byIndex(slots), delay: null };
  }
  while (from > 0 && kept(from - 1)) {
    from--;
    const slots = textSlots(texts.slice(from, to), beginAt(from), endAt(to - 1));
    if (slots) return { slots: byIndex(slots), delay: null };
  }
  const end = endAt(to - 1);
  const ms = to - from - (msFromSeconds(end) - msFromSeconds(beginAt(from)));
  const slots = textSlots(texts.slice(from, to), beginAt(from), atMs(end, ms)) ?? [];
  return { slots: byIndex(slots), delay: { from: to, start: from, run: runStart, ms } };
}

const atMs = (seconds: number, ms: number) => Math.round((seconds + ms / 1000) * 1e9) / 1e9;

// -- Functions ----------------------------------------------------------------

function insertSlot(prevEnd: number, nextBegin: number): { begin: number; end: number } {
  return { begin: prevEnd, end: Math.max(prevEnd, nextBegin) };
}

// Words moved later for room stay before `limit`, where the line must end (the song's end, the next line's start): spread
// at a millisecond each from the first moved word when that fits, else the typed run and every word after it untimed.
function remapWordTextsWithinLimit(
  oldWords: WordTiming[],
  newText: string,
  splitChar: string,
  limit = Number.POSITIVE_INFINITY,
): LimitedWords {
  const { texts, glued } = withTypedGroupsApart(tokenizeWordTexts(newText, splitChar), oldWords, splitChar);
  const oldKeys = oldWords.map((w) => wordKey(w.text, splitChar));
  const newKeys = texts.map((value) => wordKey(value, splitChar));
  const sameCount = texts.length === oldWords.length;
  const pairs = sameCount && newKeys.every((key, i) => key === oldKeys[i]) ? null : lcsPairs(oldKeys, newKeys);
  // Same count with every kept word in its place is a rename; a word that moved means words merged and others came.
  if (sameCount && (!pairs || pairs.every(([oldIdx, newIdx]) => oldIdx === newIdx))) {
    const remapped = oldWords.map((oldWord, i) => ({ ...oldWord, ...splitTrailingWhitespace(texts[i]) }));
    const words = joinedToTypedText(
      remapped,
      texts,
      oldWords,
      oldWords.map((_, i) => i),
      glued,
    );
    return { words, untimedFrom: words.length };
  }

  const oldIndexOf: Array<number | undefined> = new Array(texts.length);
  for (const [oldIdx, newIdx] of pairs ?? []) oldIndexOf[newIdx] = oldIdx;

  const result: WordTiming[] = [];
  const retimed = new Map<number, { begin: number; end: number }>();
  const delays: Delay[] = [];
  let i = 0;
  while (i < texts.length) {
    const matched = oldIndexOf[i];
    if (matched !== undefined) {
      result.push({ ...oldWords[matched], ...splitTrailingWhitespace(texts[i]) });
      i++;
      continue;
    }

    let runEnd = i;
    while (runEnd < texts.length && oldIndexOf[runEnd] === undefined) runEnd++;
    const prevOld = i > 0 ? (oldIndexOf[i - 1] as number) : -1;
    const nextOld = runEnd < texts.length ? (oldIndexOf[runEnd] as number) : oldWords.length;
    const leftBracket = oldWords[prevOld];
    const rightBracket = oldWords[nextOld];

    const runTexts = texts.slice(i, runEnd);
    let slot: { begin: number; end: number };
    if (prevOld + 1 < nextOld) {
      slot = { begin: oldWords[prevOld + 1].begin, end: oldWords[nextOld - 1].end };
    } else {
      const prevEnd = leftBracket ? leftBracket.end : rightBracket.begin;
      slot = insertSlot(prevEnd, rightBracket ? rightBracket.begin : prevEnd);
    }
    // With under a millisecond each, the typed words share the time of the kept words around them by letters, as a
    // typed split does; a run after every kept word stays for the untimed tail.
    const roomMs = msFromSeconds(slot.end) - msFromSeconds(slot.begin);
    if (roomMs < runTexts.length && rightBracket) {
      const shared = sharedSlots(texts, oldIndexOf, oldWords, slot, i, runEnd);
      for (const [index, span] of shared.slots) retimed.set(index, span);
      if (shared.delay) delays.push(shared.delay);
    }

    for (const { text, begin, end } of spreadEvenly(runTexts, slot.begin, slot.end)) {
      result.push(
        synthesizeBracketedWord({ ...splitTrailingWhitespace(text), begin, end, joinsNext: false, explicit: false }),
      );
    }
    i = runEnd;
  }

  const shared = result.map((word, index) => {
    const slot = retimed.get(index);
    const delayMs = delays.reduce((sum, delay) => (index >= delay.from ? sum + delay.ms : sum), 0);
    const placed = slot ? { ...word, ...slot } : word;
    return delayMs > 0 ? { ...placed, begin: atMs(placed.begin, delayMs), end: atMs(placed.end, delayMs) } : placed;
  });
  return withinLimit(joinedToTypedText(shared, texts, oldWords, oldIndexOf, glued), delays, limit);
}

function withinLimit(words: WordTiming[], delays: readonly Delay[], limit: number): LimitedWords {
  const whole = { words, untimedFrom: words.length };
  if (delays.length === 0) return whole;
  const timedEnd = Math.max(...words.flatMap((word) => (word.end > word.begin ? [word.end] : [])));
  if (msFromSeconds(timedEnd) <= msFromSeconds(limit)) return whole;
  const start = Math.min(...delays.map((delay) => delay.start));
  let count = words.length - start;
  while (count > 0 && words[start + count - 1].end <= words[start + count - 1].begin) count--;
  const fromMs = msFromSeconds(words[start].begin);
  const roomMs = msFromSeconds(limit) - fromMs;
  if (roomMs < count) return { words, untimedFrom: Math.min(...delays.map((delay) => delay.run)) };
  const spread = words.map((word, index) => {
    const k = index - start;
    if (k < 0 || k >= count) return word;
    return {
      ...word,
      begin: (fromMs + Math.floor((k * roomMs) / count)) / 1000,
      end: (fromMs + Math.floor(((k + 1) * roomMs) / count)) / 1000,
    };
  });
  return { words: spread, untimedFrom: words.length };
}

function remapWordTextsPreservingTiming(oldWords: WordTiming[], newText: string, splitChar: string): WordTiming[] {
  return remapWordTextsWithinLimit(oldWords, newText, splitChar).words;
}

// -- Exports ------------------------------------------------------------------

export { insertSlot, remapWordTextsPreservingTiming, remapWordTextsWithinLimit };

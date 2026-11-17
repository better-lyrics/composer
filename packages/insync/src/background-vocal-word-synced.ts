import type { ExtractOptions, LineClassification, ParenGroup } from "./background-vocal-extraction";
import {
  type BackgroundSeparator,
  type BracketJoin,
  joinBackgroundText,
  joinBracketedCarriedWords,
  joinExtractedParts,
} from "./background-vocal-brackets";
import { gluedGroups } from "./background-vocal-glued-groups";
import { splitTrailingWhitespace } from "./from-words";
import { withBackground } from "./line-background";
import type { LyricLine, Syllable } from "./line";
import { wordContentSpans } from "./line-reconstruct-text";
import { backgroundText } from "./line-text";
import { backgroundTrack, isTimedSyllable, mainTrack } from "./line-track";
import { withMainTrack, withTrackSyllables } from "./line-track-writes";
import { createInitialBgWords } from "./lyric-words";
import { mainBounds } from "./line-bounds";
import { firstBegin } from "./word-bounds";
import { remapWordTextsWithinLimit } from "./word-remap-text";
import type { WordTiming } from "./word-timing";

// -- Functions ----------------------------------------------------------------

const groupsText = (groups: readonly ParenGroup[], separator: BackgroundSeparator) =>
  joinExtractedParts(groups.map((group) => group.inner.trim()).filter(Boolean), separator);

function hasSungContent(text: string, splitChar: string): boolean {
  return [...text].some((char) => !"() ".includes(char) && char !== splitChar);
}

// Typed syllables sit untimed after the timed ones; bracketed ones keep timing only when every one has it. A group a
// syllable reaches into stays text and never keeps the other groups from extracting.
function extractInlineWordSynced(
  line: LyricLine,
  classified: LineClassification,
  options: ExtractOptions,
  splitChar: string,
  songEnd = Number.POSITIVE_INFINITY,
): LyricLine {
  const words = mainTrack(line).syllables;
  const spans = wordContentSpans(words, splitChar);
  const glued = gluedGroups(line, classified.groups, splitChar);
  const groups = classified.groups.filter((group) => !glued.has(group));
  const bgText = groupsText(groups, options.separator);
  if (!bgText) return line;
  const survivors: Syllable[] = [];
  const bracketed: Syllable[] = [];
  for (let i = 0; i < words.length; i++) {
    const span = spans[i];
    let insideCount = 0;
    for (const g of groups) {
      const groupStart = g.start;
      const groupEnd = g.end + 1;
      const overlaps = span.start < groupEnd && span.end > groupStart;
      if (!overlaps) continue;
      insideCount++;
    }
    if (insideCount === 0) {
      survivors.push(words[i]);
      continue;
    }
    // A word the group was glued onto ends there now, so the main text after the group starts a new word.
    const previous = words[i - 1];
    if (previous && survivors.at(-1) === previous && previous.sep === "" && !previous.joinsNext)
      survivors[survivors.length - 1] = { ...previous, sep: " " };
    if (options.preserveBrackets || hasSungContent(words[i].text, splitChar)) bracketed.push(words[i]);
  }
  if (survivors.length === 0) return line;
  const trimmedSurvivors = survivors.map((word, i) =>
    i === survivors.length - 1
      ? { ...word, ...splitTrailingWhitespace((word.text + word.sep).replace(/ +$/, "")), joinsNext: false }
      : word,
  );
  const base = backgroundText(line, splitChar)?.trim();
  const fromExtraction = backgroundTrack(line)?.source === "extraction";
  const joined = joinBackgroundText(base, bgText, options);
  const timedBracketed = bracketed.filter(isTimedSyllable);
  const carried = timedBracketed.length === bracketed.length ? timedBracketed : [];
  return withBackground(
    withMainTrack(line, withTrackSyllables(mainTrack(line), trimmedSurvivors)),
    {
      text: joined,
      words: timedBackgroundWords(
        line,
        base,
        carried,
        joinBackgroundText(undefined, bgText, options),
        options,
        splitChar,
        songEnd,
      ),
      source: base && !fromExtraction ? "manual" : "extraction",
    },
    splitChar,
  );
}

// Bracketed words that were all timed keep their timing; an untimed background before them is seeded in the second
// half of the line up to where they begin, so timed words stay in text order. Without that room the whole is untimed.
function timedBackgroundWords(
  line: LyricLine,
  base: string | undefined,
  carried: WordTiming[],
  addition: string,
  join: BracketJoin,
  splitChar: string,
  songEnd: number,
): WordTiming[] | undefined {
  if (carried.length === 0) return undefined;
  const remapped = remapWordTextsWithinLimit(carried, addition, splitChar, songEnd);
  const sung = remapped.words.slice(0, remapped.untimedFrom);
  if (!base) return sung;
  const bounds = mainBounds(line);
  if (sung.length < remapped.words.length || !bounds) return undefined;
  const end = firstBegin(sung);
  const middle = (bounds.begin + bounds.end) / 2;
  const seedBegin = middle < end ? middle : bounds.begin;
  if (end <= seedBegin) return undefined;
  const baseWords = createInitialBgWords(base, seedBegin, end, splitChar);
  return baseWords.length === 0 ? undefined : joinBracketedCarriedWords(baseWords, sung, join);
}

// -- Exports ------------------------------------------------------------------

export { extractInlineWordSynced, groupsText };

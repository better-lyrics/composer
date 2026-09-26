import { effectiveBounds } from "@/domain/line/bounds";
import { isLineSynced } from "@/domain/line/predicates";
import type { LyricLine } from "@/domain/line/model";
import type { SyncCursor } from "@/domain/sync/cursor";
import type { WordTiming } from "@/domain/word/timing";
import { useSettingsStore } from "@/stores/settings";
import { formatTime } from "@/utils/format-time";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

interface SyncState {
  position: SyncCursor;
  isActive: boolean;
  // True when the cursor was placed by a jump rather than by advancing through
  // the song. Tapping the first word of a line closes the previous line so the
  // two meet, which is right in a forward pass but stretches an already-correct
  // line when the user jumped back to re-record this one.
  jumpedToPosition?: boolean;
}

// -- Constants ----------------------------------------------------------------

function getNudgeAmount(): number {
  return useSettingsStore.getState().nudgeAmount;
}

// -- Functions ----------------------------------------------------------------

function splitIntoWords(text: string): string[] {
  if (!text) return [];
  const char = getSplitCharacter();
  return text.split(/\s+/).flatMap((w) => (w.length > 0 ? w.split(char).filter((p) => p.length > 0) : []));
}

function splitIntoWordsWithMeta(text: string): { parts: string[]; trailingSpace: boolean[] } {
  const char = getSplitCharacter();
  const tokens = text.split(/\s+/).filter((w) => w.length > 0);
  const parts: string[] = [];
  const trailingSpace: boolean[] = [];
  for (let t = 0; t < tokens.length; t++) {
    const syllables = tokens[t].split(char).filter((p) => p.length > 0);
    const isLastToken = t === tokens.length - 1;
    for (let s = 0; s < syllables.length; s++) {
      parts.push(syllables[s]);
      const isLastSyllable = s === syllables.length - 1;
      trailingSpace.push(isLastSyllable && !isLastToken);
    }
  }
  return { parts, trailingSpace };
}

const formatTimeMs = (seconds: number) => formatTime(seconds, 3);

function parseTimeMs(str: string): number | null {
  const trimmed = str.trim();
  // Format: M:SS.mmm or MM:SS.mmm
  const match = trimmed.match(/^(\d+):(\d{1,2})(?:\.(\d{1,3}))?$/);
  if (!match) return null;
  const mins = Number.parseInt(match[1], 10);
  const secs = Number.parseInt(match[2], 10);
  const ms = match[3] ? Number.parseInt(match[3].padEnd(3, "0"), 10) : 0;
  if (secs >= 60) return null;
  return mins * 60 + secs + ms / 1000;
}

// -- Conversion Functions -----------------------------------------------------

interface ConvertibleLine {
  text: string;
  begin?: number;
  end?: number;
  words?: WordTiming[];
}

function convertLineToWord<T extends ConvertibleLine>(line: T): T {
  if (line.words?.length) return line;
  if (line.begin === undefined || line.end === undefined) return line;

  const lineBegin = line.begin;
  const lineEnd = line.end;
  const { parts: wordTexts, trailingSpace } = splitIntoWordsWithMeta(line.text);
  if (wordTexts.length === 0) return line;

  const duration = lineEnd - lineBegin;
  const wordDuration = duration / wordTexts.length;

  const words: WordTiming[] = wordTexts.map((text, i) => ({
    text: trailingSpace[i] ? `${text} ` : text,
    begin: lineBegin + i * wordDuration,
    end: lineBegin + (i + 1) * wordDuration,
  }));

  return { ...line, words, begin: undefined, end: undefined };
}

function hasLineTiming(lines: LyricLine[]): boolean {
  return lines.some(isLineSynced);
}

// -- Word Distribution --------------------------------------------------------

const DEFAULT_BG_WORD_DURATION = 0.3;

function distributeWordsInLine(text: string, begin: number, end: number): WordTiming[] {
  const { parts: words, trailingSpace } = splitIntoWordsWithMeta(text);
  if (words.length === 0) return [];

  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  const duration = end - begin;

  let currentTime = begin;
  return words.map((word, i) => {
    const wordDuration = (word.length / totalChars) * duration;
    const wordTiming: WordTiming = {
      text: trailingSpace[i] ? `${word} ` : word,
      begin: currentTime,
      end: currentTime + wordDuration,
    };
    currentTime += wordDuration;
    return wordTiming;
  });
}

// -- BG Word Creation ---------------------------------------------------------

function createInitialBgWords(backgroundText: string, begin: number, end?: number): WordTiming[] {
  const wordCount = splitIntoWords(backgroundText).length;
  if (wordCount === 0) return [];
  const resolvedEnd = end ?? begin + wordCount * DEFAULT_BG_WORD_DURATION;
  return distributeWordsInLine(backgroundText, begin, resolvedEnd);
}

function createBgWordsFromTextAt(line: LyricLine, begin: number, maxEnd: number): WordTiming[] | null {
  if (!line.backgroundText || line.backgroundWords?.length) return null;
  const naturalEnd = begin + splitIntoWords(line.backgroundText).length * DEFAULT_BG_WORD_DURATION;
  const words = createInitialBgWords(line.backgroundText, begin, Math.min(maxEnd, naturalEnd));
  return words.length > 0 ? words : null;
}

function createBgWordsFromLine(line: LyricLine): WordTiming[] | null {
  if (!line.backgroundText) return null;
  const timing = effectiveBounds(line);
  if (!timing) return null;
  return createInitialBgWords(line.backgroundText, (timing.begin + timing.end) / 2, timing.end);
}

function withSeededBackgroundWords(line: LyricLine): LyricLine {
  if (!line.backgroundText || line.backgroundWords?.length) return line;
  const backgroundWords = createBgWordsFromLine(line);
  return backgroundWords ? { ...line, backgroundWords } : line;
}

// -- Exports ------------------------------------------------------------------

export {
  createBgWordsFromLine,
  createBgWordsFromTextAt,
  createInitialBgWords,
  distributeWordsInLine,
  getNudgeAmount,
  convertLineToWord,
  formatTimeMs,
  hasLineTiming,
  parseTimeMs,
  splitIntoWords,
  splitIntoWordsWithMeta,
  withSeededBackgroundWords,
};
export type { SyncState };

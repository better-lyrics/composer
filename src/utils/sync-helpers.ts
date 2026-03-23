import type { WordTiming } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

interface SyncPosition {
  lineIndex: number;
  wordIndex: number;
}

interface SyncState {
  position: SyncPosition;
  isActive: boolean;
}

interface LineTiming {
  begin: number;
  end: number;
}

// -- Constants ----------------------------------------------------------------

function getNudgeAmount(): number {
  return useSettingsStore.getState().nudgeAmount;
}

// -- Functions ----------------------------------------------------------------

function splitIntoWords(text: string): string[] {
  const char = getSplitCharacter();
  return text
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .flatMap((w) => w.split(char).filter((p) => p.length > 0));
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

function formatTimeMs(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00.000";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

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

function getTotalWords(lines: { text: string }[]): number {
  return lines.reduce((acc, line) => acc + splitIntoWords(line.text).length, 0);
}

function getSyncedWordCount(lines: { words?: WordTiming[] }[]): number {
  return lines.reduce((acc, line) => acc + (line.words?.length ?? 0), 0);
}

function getLineTiming(line: {
  begin?: number;
  end?: number;
  words?: WordTiming[];
}): LineTiming | null {
  if (line.words?.length) {
    const firstWord = line.words[0];
    const lastWord = line.words[line.words.length - 1];
    return { begin: firstWord.begin, end: lastWord.end };
  }
  if (line.begin !== undefined && line.end !== undefined) {
    return { begin: line.begin, end: line.end };
  }
  return null;
}

function getSyncedLineCount(lines: { begin?: number; end?: number; words?: WordTiming[] }[]): number {
  return lines.filter((line) => getLineTiming(line) !== null).length;
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

function convertWordToLine<T extends ConvertibleLine>(line: T): T {
  if (!line.words?.length) return line;

  const firstWord = line.words[0];
  const lastWord = line.words[line.words.length - 1];

  return {
    ...line,
    begin: firstWord.begin,
    end: lastWord.end,
    words: undefined,
  };
}

function hasWordTiming(lines: ConvertibleLine[]): boolean {
  return lines.some((line) => line.words?.length);
}

function hasLineTiming(lines: ConvertibleLine[]): boolean {
  return lines.some((line) => line.begin !== undefined && line.end !== undefined && !line.words?.length);
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

function createBgWordsFromLine(
  line: { begin?: number; end?: number; words?: WordTiming[]; backgroundText?: string },
): WordTiming[] | null {
  if (!line.backgroundText) return null;
  const timing = getLineTiming(line);
  if (!timing) return null;
  return createInitialBgWords(line.backgroundText, (timing.begin + timing.end) / 2, timing.end);
}

// -- Exports ------------------------------------------------------------------

export {
  createBgWordsFromLine,
  createInitialBgWords,
  distributeWordsInLine,
  getNudgeAmount,
  convertLineToWord,
  convertWordToLine,
  formatTimeMs,
  getLineTiming,
  getSyncedLineCount,
  getSyncedWordCount,
  getTotalWords,
  hasLineTiming,
  hasWordTiming,
  parseTimeMs,
  splitIntoWords,
  splitIntoWordsWithMeta,
};
export type { LineTiming, SyncPosition, SyncState };

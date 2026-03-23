import type { LyricLine, WordTiming } from "@/stores/project";
import { formatTime as formatTimeBase } from "@/utils/format-time";
import { stripSplitCharacter } from "@/utils/split-character";
import { distributeWordsInLine, getLineTiming } from "@/utils/sync-helpers";

// -- Functions -----------------------------------------------------------------

function distributeLinesTiming<T extends { id: string; text: string }>(
  lines: T[],
  duration: number,
): (T & { begin: number; end: number; words: WordTiming[] })[] {
  if (lines.length === 0) return [];

  const lineDuration = duration / lines.length;

  return lines.map((line, index) => {
    const begin = index * lineDuration;
    const end = (index + 1) * lineDuration;
    return {
      ...line,
      begin,
      end,
      words: distributeWordsInLine(line.text, begin, end),
    };
  });
}

const formatTime = (seconds: number) => formatTimeBase(seconds, 2);

interface WordAtTimeResult {
  lineId: string;
  lineIndex: number;
  wordIndex: number;
  type: "word" | "bg";
}

function findWordAtTime(lines: LyricLine[], time: number): WordAtTimeResult | null {
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];

    if (line.words) {
      for (let wordIndex = 0; wordIndex < line.words.length; wordIndex++) {
        const word = line.words[wordIndex];
        if (time >= word.begin && time < word.end) {
          return { lineId: line.id, lineIndex, wordIndex, type: "word" };
        }
      }
    }

    if (line.backgroundWords) {
      for (let wordIndex = 0; wordIndex < line.backgroundWords.length; wordIndex++) {
        const word = line.backgroundWords[wordIndex];
        if (time >= word.begin && time < word.end) {
          return { lineId: line.id, lineIndex, wordIndex, type: "bg" };
        }
      }
    }
  }

  return null;
}

function isLineSynced(line: LyricLine): boolean {
  return !line.words?.length && line.begin !== undefined && line.end !== undefined;
}

function getEffectiveLines(lines: LyricLine[]): LyricLine[] {
  return lines.map((line) => {
    if (!isLineSynced(line)) return line;
    return {
      ...line,
      words: [{ text: stripSplitCharacter(line.text), begin: line.begin!, end: line.end! }],
    };
  });
}

// -- Exports -------------------------------------------------------------------

export {
  distributeWordsInLine,
  distributeLinesTiming,
  getLineTiming,
  formatTime,
  findWordAtTime,
  isLineSynced,
  getEffectiveLines,
};

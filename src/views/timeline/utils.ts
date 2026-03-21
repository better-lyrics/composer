import type { LyricLine, WordTiming } from "@/stores/project";
import { distributeWordsInLine } from "@/utils/sync-helpers";

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

function getLineTiming(line: LyricLine): { begin: number; end: number } | null {
  if (line.words?.length) {
    return { begin: line.words[0].begin, end: line.words[line.words.length - 1].end };
  }
  if (line.begin !== undefined && line.end !== undefined) {
    return { begin: line.begin, end: line.end };
  }
  return null;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

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

// -- Exports -------------------------------------------------------------------

export { distributeWordsInLine, distributeLinesTiming, getLineTiming, formatTime, findWordAtTime };

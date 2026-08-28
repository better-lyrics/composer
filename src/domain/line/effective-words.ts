import { getLanguageDisplayLine } from "@/domain/language/display";
import type { LyricLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import type { WordTiming } from "@/domain/word/timing";
import { stripSplitCharacter } from "@/utils/split-character";

// -- Functions ----------------------------------------------------------------

function effectiveWords(line: LyricLine): WordTiming[] {
  if (line.words?.length) return line.words;
  if (isLineSynced(line)) {
    return [{ text: stripSplitCharacter(line.text), begin: line.begin, end: line.end }];
  }
  return [];
}

function withEffectiveWords(line: LyricLine): LyricLine {
  if (!isLineSynced(line)) return line;
  const { begin: _begin, end: _end, ...rest } = line;
  return { ...rest, words: effectiveWords(line) };
}

function getEffectiveLines(lines: LyricLine[]): LyricLine[] {
  return lines.map((line) => {
    const effectiveLine = withEffectiveWords(line);
    const display = getLanguageDisplayLine(effectiveLine, "transliteration", "spaces");
    return {
      ...effectiveLine,
      ...(display.words ? { words: display.words } : {}),
      ...(display.backgroundWords ? { backgroundWords: display.backgroundWords } : {}),
    } as LyricLine;
  });
}

// -- Exports ------------------------------------------------------------------

export { effectiveWords, getEffectiveLines };

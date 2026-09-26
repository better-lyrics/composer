import type { WordTiming } from "@/domain/word/timing";
import { distributeTiming } from "@/utils/syllable-utils";

// -- Functions -----------------------------------------------------------------

function splitWordIntoWords(word: WordTiming, splitPoints: number[]): WordTiming[] {
  const trimmed = word.text.trimEnd();
  const hadTrailingSpace = word.text.endsWith(" ");
  const { syllableGroupId: _drop, ...base } = word;

  const parts: Array<{ text: string; begin: number; end: number }> = [];
  let orphanBegin: number | null = null;
  for (const part of distributeTiming(trimmed, splitPoints, word.begin, word.end)) {
    const text = part.text.trim();
    const last = parts[parts.length - 1];
    if (text === "") {
      if (last) last.end = part.end;
      else orphanBegin ??= part.begin;
      continue;
    }
    parts.push({ text, begin: orphanBegin ?? part.begin, end: part.end });
    orphanBegin = null;
  }

  return parts.map((part, index) => {
    const isLast = index === parts.length - 1;
    const trailing = isLast ? (hadTrailingSpace ? " " : "") : " ";
    return { ...base, text: `${part.text}${trailing}`, begin: part.begin, end: part.end };
  });
}

// -- Exports -------------------------------------------------------------------

export { splitWordIntoWords };

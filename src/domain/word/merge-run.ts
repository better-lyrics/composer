import { computeByGroupId } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

interface IndexSpan {
  start: number;
  end: number;
}

// -- Functions ----------------------------------------------------------------

function mergeWordText(texts: string[]): string {
  return texts.map((text, index) => (index === texts.length - 1 ? text : text.trimEnd())).join("");
}

function mergedTransliteration(words: WordTiming[]): string | undefined {
  const parts: string[] = [];
  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    const part = word.transliteration?.trim();
    if (!part) return undefined;
    if (index > 0) parts.push(words[index - 1].transliterationJoinerAfter ?? " ");
    parts.push(part);
  }
  return parts.join("");
}

function runSpan(words: WordTiming[], indices: number[]): IndexSpan | null {
  if (indices.length < 2) return null;
  const start = Math.min(...indices);
  const end = Math.max(...indices);
  if (start < 0 || end >= words.length) return null;
  return { start, end };
}

function groupSpanAt(words: WordTiming[], index: number): IndexSpan | null {
  const group = computeByGroupId(words).find((g) => index >= g.startIndex && index <= g.endIndex);
  return group ? { start: group.startIndex, end: group.endIndex } : null;
}

function isPartialSyllableRun(words: WordTiming[], indices: number[]): boolean {
  const span = runSpan(words, indices);
  if (!span) return false;
  const group = groupSpanAt(words, span.start);
  if (!group || span.end > group.end) return false;
  return span.start > group.start || span.end < group.end;
}

function isWholeSyllableGroupRun(words: WordTiming[], indices: number[]): boolean {
  const span = runSpan(words, indices);
  if (!span) return false;
  const group = groupSpanAt(words, span.start);
  return group !== null && group.start === span.start && group.end === span.end;
}

function expandedToWholeGroups(words: WordTiming[], span: IndexSpan): IndexSpan {
  return {
    start: groupSpanAt(words, span.start)?.start ?? span.start,
    end: groupSpanAt(words, span.end)?.end ?? span.end,
  };
}

function mergedWord(run: WordTiming[], syllableGroupId: string | undefined): WordTiming {
  const first = run[0];
  const last = run[run.length - 1];
  const {
    syllableGroupId: _group,
    transliteration: _transliteration,
    transliterationJoinerAfter: _joiner,
    ...rest
  } = first;
  const transliteration = mergedTransliteration(run);
  return {
    ...rest,
    text: mergeWordText(run.map((word) => word.text)),
    begin: first.begin,
    end: last.end,
    ...(syllableGroupId !== undefined ? { syllableGroupId } : {}),
    ...(transliteration ? { transliteration } : {}),
    ...(last.transliterationJoinerAfter !== undefined
      ? { transliterationJoinerAfter: last.transliterationJoinerAfter }
      : {}),
  };
}

function mergeWordRun(words: WordTiming[], indices: number[]): WordTiming[] | null {
  const span = runSpan(words, indices);
  if (!span) return null;
  const partial = isPartialSyllableRun(words, indices);
  const { start, end } = partial ? span : expandedToWholeGroups(words, span);
  const merged = mergedWord(words.slice(start, end + 1), partial ? words[start].syllableGroupId : undefined);
  return [...words.slice(0, start), merged, ...words.slice(end + 1)];
}

// -- Exports ------------------------------------------------------------------

export { isPartialSyllableRun, isWholeSyllableGroupRun, mergeWordRun, mergeWordText, mergedTransliteration };

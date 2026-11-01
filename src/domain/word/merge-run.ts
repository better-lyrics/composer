import { computeByGroupId } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

interface CopyMergeCover {
  inside: number[];
  overlapping: number[];
}

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

function mergedSpan(words: WordTiming[], indices: number[]): IndexSpan | null {
  const span = runSpan(words, indices);
  if (!span) return null;
  return isPartialSyllableRun(words, indices) ? span : expandedToWholeGroups(words, span);
}

function mergeWordRun(words: WordTiming[], indices: number[]): WordTiming[] | null {
  const span = mergedSpan(words, indices);
  if (!span) return null;
  const { start, end } = span;
  const groupId = isPartialSyllableRun(words, indices) ? words[start].syllableGroupId : undefined;
  const merged = mergedWord(words.slice(start, end + 1), groupId);
  return [...words.slice(0, start), merged, ...words.slice(end + 1)];
}

function textOffsets(words: WordTiming[]): number[] {
  const offsets = [0];
  for (const word of words) offsets.push(offsets[offsets.length - 1] + word.text.length);
  return offsets;
}

// Linked copies share their text, so a run maps onto a copy by the characters it covers, not by word slots.
function copyMergeCover(source: WordTiming[], sourceIndices: number[], target: WordTiming[]): CopyMergeCover {
  const span = mergedSpan(source, sourceIndices);
  if (!span) return { inside: [], overlapping: [] };
  const sourceOffsets = textOffsets(source);
  const start = sourceOffsets[span.start];
  const end = sourceOffsets[span.end + 1];
  const targetOffsets = textOffsets(target);
  const inside: number[] = [];
  const overlapping: number[] = [];
  for (let index = 0; index < target.length; index++) {
    const wordStart = targetOffsets[index];
    const wordEnd = targetOffsets[index + 1];
    if (wordStart < end && wordEnd > start) overlapping.push(index);
    if (wordStart >= start && wordEnd <= end) inside.push(index);
  }
  return { inside, overlapping };
}

// -- Exports ------------------------------------------------------------------

export {
  copyMergeCover,
  isPartialSyllableRun,
  isWholeSyllableGroupRun,
  mergeWordRun,
  mergeWordText,
  mergedTransliteration,
  mergedWord,
};

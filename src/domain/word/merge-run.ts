import { splitTrailingWhitespace } from "insync/from-words";
import { computeSyllableGroups } from "@/domain/word/syllable-groups";
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

function runSpan(words: WordTiming[], indices: number[]): IndexSpan | null {
  if (indices.length < 2) return null;
  const start = Math.min(...indices);
  const end = Math.max(...indices);
  if (start < 0 || end >= words.length) return null;
  return { start, end };
}

function groupSpanAt(words: WordTiming[], index: number): IndexSpan | null {
  const group = computeSyllableGroups(words).find((g) => index >= g.startIndex && index <= g.endIndex);
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

// A merged run ends where its last word ended, so it joins the next word only when that one did. It keeps the
// first word's id, which is how the run's language pieces find it.
function mergedWord(run: WordTiming[]): WordTiming {
  const first = run[0];
  const last = run[run.length - 1];
  return {
    ...first,
    ...splitTrailingWhitespace(mergeWordText(run.map((word) => word.text + word.sep))),
    begin: first.begin,
    end: last.end,
    joinsNext: last.joinsNext,
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
  const merged = mergedWord(words.slice(start, end + 1));
  return [...words.slice(0, start), merged, ...words.slice(end + 1)];
}

// -- Exports ------------------------------------------------------------------

export { isPartialSyllableRun, isWholeSyllableGroupRun, mergeWordRun, mergeWordText, mergedWord };

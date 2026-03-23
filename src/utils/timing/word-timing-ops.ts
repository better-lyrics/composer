import type { LyricLine, WordTiming } from "@/stores/project";

// -- Types --------------------------------------------------------------------

type UpdateLineWithHistory = (id: string, updates: Partial<LyricLine>) => void;

interface WordFieldConfig {
  getWords: (line: LyricLine) => WordTiming[] | undefined;
  updateKey: "words" | "backgroundWords";
}

// -- Factory ------------------------------------------------------------------

function createWordTimingOps(config: WordFieldConfig) {
  const { getWords, updateKey } = config;

  function nudgeBegin(
    lines: LyricLine[],
    lineIdx: number,
    wordIdx: number,
    delta: number,
    updateLineWithHistory: UpdateLineWithHistory,
  ) {
    const line = lines[lineIdx];
    const words = getWords(line);
    if (!words?.[wordIdx]) return;

    const updatedWords = [...words];
    const word = updatedWords[wordIdx];
    const prevWord = updatedWords[wordIdx - 1];
    const minBegin = prevWord?.end ?? 0;
    const newBegin = Math.min(word.end, Math.max(minBegin, word.begin + delta));

    updatedWords[wordIdx] = { ...word, begin: newBegin };
    updateLineWithHistory(line.id, { [updateKey]: updatedWords } as Partial<LyricLine>);
  }

  function setBegin(
    lines: LyricLine[],
    lineIdx: number,
    wordIdx: number,
    newBegin: number,
    updateLineWithHistory: UpdateLineWithHistory,
  ) {
    const line = lines[lineIdx];
    const words = getWords(line);
    if (!words?.[wordIdx]) return;

    const updatedWords = [...words];
    const word = updatedWords[wordIdx];
    const prevWord = updatedWords[wordIdx - 1];
    const minBegin = prevWord?.end ?? 0;
    const clampedBegin = Math.min(word.end, Math.max(minBegin, newBegin));
    updatedWords[wordIdx] = { ...word, begin: clampedBegin };
    updateLineWithHistory(line.id, { [updateKey]: updatedWords } as Partial<LyricLine>);
  }

  function nudgeEnd(
    lines: LyricLine[],
    lineIdx: number,
    wordIdx: number,
    delta: number,
    updateLineWithHistory: UpdateLineWithHistory,
  ) {
    const line = lines[lineIdx];
    const words = getWords(line);
    if (!words?.[wordIdx]) return;

    const updatedWords = [...words];
    const word = updatedWords[wordIdx];
    const nextWord = updatedWords[wordIdx + 1];
    const maxEnd = nextWord?.begin ?? Number.POSITIVE_INFINITY;
    const newEnd = Math.min(maxEnd, Math.max(word.begin, word.end + delta));

    updatedWords[wordIdx] = { ...word, end: newEnd };
    updateLineWithHistory(line.id, { [updateKey]: updatedWords } as Partial<LyricLine>);
  }

  function setEnd(
    lines: LyricLine[],
    lineIdx: number,
    wordIdx: number,
    newEnd: number,
    updateLineWithHistory: UpdateLineWithHistory,
  ) {
    const line = lines[lineIdx];
    const words = getWords(line);
    if (!words?.[wordIdx]) return;

    const updatedWords = [...words];
    const word = updatedWords[wordIdx];
    const nextWord = updatedWords[wordIdx + 1];
    const maxEnd = nextWord?.begin ?? Number.POSITIVE_INFINITY;
    const clampedEnd = Math.min(maxEnd, Math.max(word.begin, newEnd));
    updatedWords[wordIdx] = { ...word, end: clampedEnd };
    updateLineWithHistory(line.id, { [updateKey]: updatedWords } as Partial<LyricLine>);
  }

  return { nudgeBegin, setBegin, nudgeEnd, setEnd };
}

// -- Exports -------------------------------------------------------------------

export { createWordTimingOps };
export type { UpdateLineWithHistory };

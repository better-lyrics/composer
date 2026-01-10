import type { LyricLine } from "@/stores/project";

type UpdateLineWithHistory = (id: string, updates: Partial<LyricLine>) => void;

function nudgeBgWordBegin(
  lines: LyricLine[],
  lineIdx: number,
  wordIdx: number,
  delta: number,
  updateLineWithHistory: UpdateLineWithHistory,
) {
  const line = lines[lineIdx];
  if (!line?.backgroundWords?.[wordIdx]) return;

  const updatedWords = [...line.backgroundWords];
  const word = updatedWords[wordIdx];
  const prevWord = updatedWords[wordIdx - 1];
  const minBegin = prevWord?.end ?? 0;
  const newBegin = Math.min(word.end, Math.max(minBegin, word.begin + delta));

  updatedWords[wordIdx] = { ...word, begin: newBegin };
  updateLineWithHistory(line.id, { backgroundWords: updatedWords });
}

function setBgWordBegin(
  lines: LyricLine[],
  lineIdx: number,
  wordIdx: number,
  newBegin: number,
  updateLineWithHistory: UpdateLineWithHistory,
) {
  const line = lines[lineIdx];
  if (!line?.backgroundWords?.[wordIdx]) return;

  const updatedWords = [...line.backgroundWords];
  const word = updatedWords[wordIdx];
  const prevWord = updatedWords[wordIdx - 1];
  const minBegin = prevWord?.end ?? 0;
  const clampedBegin = Math.min(word.end, Math.max(minBegin, newBegin));
  updatedWords[wordIdx] = { ...word, begin: clampedBegin };
  updateLineWithHistory(line.id, { backgroundWords: updatedWords });
}

function nudgeBgWordEnd(
  lines: LyricLine[],
  lineIdx: number,
  wordIdx: number,
  delta: number,
  updateLineWithHistory: UpdateLineWithHistory,
) {
  const line = lines[lineIdx];
  if (!line?.backgroundWords?.[wordIdx]) return;

  const updatedWords = [...line.backgroundWords];
  const word = updatedWords[wordIdx];
  const nextWord = updatedWords[wordIdx + 1];
  const maxEnd = nextWord?.begin ?? Number.POSITIVE_INFINITY;
  const newEnd = Math.min(maxEnd, Math.max(word.begin, word.end + delta));

  updatedWords[wordIdx] = { ...word, end: newEnd };
  updateLineWithHistory(line.id, { backgroundWords: updatedWords });
}

function setBgWordEnd(
  lines: LyricLine[],
  lineIdx: number,
  wordIdx: number,
  newEnd: number,
  updateLineWithHistory: UpdateLineWithHistory,
) {
  const line = lines[lineIdx];
  if (!line?.backgroundWords?.[wordIdx]) return;

  const updatedWords = [...line.backgroundWords];
  const word = updatedWords[wordIdx];
  const nextWord = updatedWords[wordIdx + 1];
  const maxEnd = nextWord?.begin ?? Number.POSITIVE_INFINITY;
  const clampedEnd = Math.min(maxEnd, Math.max(word.begin, newEnd));
  updatedWords[wordIdx] = { ...word, end: clampedEnd };
  updateLineWithHistory(line.id, { backgroundWords: updatedWords });
}

export { nudgeBgWordBegin, setBgWordBegin, nudgeBgWordEnd, setBgWordEnd };

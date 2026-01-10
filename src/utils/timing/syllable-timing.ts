import type { LyricLine, SyllableTiming } from "@/stores/project";

type UpdateLineWithHistory = (id: string, updates: Partial<LyricLine>) => void;

function splitWordIntoSyllables(
  lines: LyricLine[],
  lineIdx: number,
  wordIdx: number,
  syllables: SyllableTiming[],
  updateLineWithHistory: UpdateLineWithHistory,
) {
  const line = lines[lineIdx];
  if (!line?.words?.[wordIdx]) return;

  const updatedWords = [...line.words];
  updatedWords[wordIdx] = { ...updatedWords[wordIdx], syllables };
  updateLineWithHistory(line.id, { words: updatedWords });
}

function nudgeSyllableBegin(
  lines: LyricLine[],
  lineIdx: number,
  wordIdx: number,
  syllableIdx: number,
  delta: number,
  updateLineWithHistory: UpdateLineWithHistory,
) {
  const line = lines[lineIdx];
  const syllables = line?.words?.[wordIdx]?.syllables;
  if (!syllables?.[syllableIdx]) return;

  const updatedWords = [...line.words!];
  const updatedSyllables = [...syllables];
  const syllable = updatedSyllables[syllableIdx];
  const prevSyllable = updatedSyllables[syllableIdx - 1];
  const minBegin = prevSyllable?.end ?? 0;
  const newBegin = Math.max(minBegin, syllable.begin + delta);
  updatedSyllables[syllableIdx] = { ...syllable, begin: newBegin };
  updatedWords[wordIdx] = { ...updatedWords[wordIdx], syllables: updatedSyllables };
  updateLineWithHistory(line.id, { words: updatedWords });
}

function setSyllableBegin(
  lines: LyricLine[],
  lineIdx: number,
  wordIdx: number,
  syllableIdx: number,
  newBegin: number,
  updateLineWithHistory: UpdateLineWithHistory,
) {
  const line = lines[lineIdx];
  const syllables = line?.words?.[wordIdx]?.syllables;
  if (!syllables?.[syllableIdx]) return;

  const updatedWords = [...line.words!];
  const updatedSyllables = [...syllables];
  const syllable = updatedSyllables[syllableIdx];
  const prevSyllable = updatedSyllables[syllableIdx - 1];
  const minBegin = prevSyllable?.end ?? 0;
  const clampedBegin = Math.min(syllable.end, Math.max(minBegin, newBegin));
  updatedSyllables[syllableIdx] = { ...syllable, begin: clampedBegin };
  updatedWords[wordIdx] = { ...updatedWords[wordIdx], syllables: updatedSyllables };
  updateLineWithHistory(line.id, { words: updatedWords });
}

function nudgeSyllableEnd(
  lines: LyricLine[],
  lineIdx: number,
  wordIdx: number,
  syllableIdx: number,
  delta: number,
  updateLineWithHistory: UpdateLineWithHistory,
) {
  const line = lines[lineIdx];
  const syllables = line?.words?.[wordIdx]?.syllables;
  if (!syllables?.[syllableIdx]) return;

  const updatedWords = [...line.words!];
  const updatedSyllables = [...syllables];
  const syllable = updatedSyllables[syllableIdx];
  const nextSyllable = updatedSyllables[syllableIdx + 1];
  const maxEnd = nextSyllable?.begin ?? Number.POSITIVE_INFINITY;
  const newEnd = Math.min(maxEnd, Math.max(syllable.begin, syllable.end + delta));
  updatedSyllables[syllableIdx] = { ...syllable, end: newEnd };
  updatedWords[wordIdx] = { ...updatedWords[wordIdx], syllables: updatedSyllables };
  updateLineWithHistory(line.id, { words: updatedWords });
}

function setSyllableEnd(
  lines: LyricLine[],
  lineIdx: number,
  wordIdx: number,
  syllableIdx: number,
  newEnd: number,
  updateLineWithHistory: UpdateLineWithHistory,
) {
  const line = lines[lineIdx];
  const syllables = line?.words?.[wordIdx]?.syllables;
  if (!syllables?.[syllableIdx]) return;

  const updatedWords = [...line.words!];
  const updatedSyllables = [...syllables];
  const syllable = updatedSyllables[syllableIdx];
  const nextSyllable = updatedSyllables[syllableIdx + 1];
  const maxEnd = nextSyllable?.begin ?? Number.POSITIVE_INFINITY;
  const clampedEnd = Math.min(maxEnd, Math.max(syllable.begin, newEnd));
  updatedSyllables[syllableIdx] = { ...syllable, end: clampedEnd };
  updatedWords[wordIdx] = { ...updatedWords[wordIdx], syllables: updatedSyllables };
  updateLineWithHistory(line.id, { words: updatedWords });
}

export { splitWordIntoSyllables, nudgeSyllableBegin, setSyllableBegin, nudgeSyllableEnd, setSyllableEnd };

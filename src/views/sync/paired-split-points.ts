import { normalizeSplitPointAtSeparator } from "@/views/sync/split-separators";

interface PairedSplitPoints {
  splitPoints: number[];
  transliterationSplitPoints: number[];
}

function togglePoint(points: number[], index: number): number[] {
  return points.includes(index) ? points.filter((point) => point !== index) : [...points, index];
}

function togglePrimarySplitPoint(
  state: PairedSplitPoints,
  index: number,
  sourceText: string,
  transliteration?: string,
): PairedSplitPoints {
  const splitPoints = togglePoint(state.splitPoints, index);
  if (!transliteration) return { ...state, splitPoints };

  const sourceLength = sourceText.trimEnd().length;
  const transliterationLength = transliteration.trim().length;
  if (sourceLength === 0 || transliterationLength < 2) return { ...state, splitPoints };

  const inferred = splitPoints.map((point) => {
    const proportionalPoint = Math.max(
      1,
      Math.min(transliterationLength - 1, Math.round((point / sourceLength) * transliterationLength)),
    );
    return normalizeSplitPointAtSeparator(transliteration.trim(), proportionalPoint);
  });
  return new Set(inferred).size === inferred.length
    ? { splitPoints, transliterationSplitPoints: inferred }
    : { ...state, splitPoints };
}

function toggleTransliterationSplitPoint(state: PairedSplitPoints, index: number): PairedSplitPoints {
  return {
    ...state,
    transliterationSplitPoints: togglePoint(state.transliterationSplitPoints, index),
  };
}

export { togglePrimarySplitPoint, toggleTransliterationSplitPoint };
export type { PairedSplitPoints };

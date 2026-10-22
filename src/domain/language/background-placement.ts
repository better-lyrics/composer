import type { LyricLine } from "@/domain/line/model";

type BackgroundPlacement = { position: "front" } | { position: "middle"; afterWordIndex: number } | { position: "end" };

const TIMING_EPSILON = 1e-4;

function alternateBackgroundPlacement(line: LyricLine): BackgroundPlacement {
  const mainWords = line.words;
  const backgroundWords = line.backgroundWords;
  if (!mainWords?.length || !backgroundWords?.length) return { position: "end" };

  const mainBegin = Math.min(...mainWords.map((word) => word.begin));
  const mainEnd = Math.max(...mainWords.map((word) => word.end));
  const backgroundBegin = Math.min(...backgroundWords.map((word) => word.begin));
  const backgroundEnd = Math.max(...backgroundWords.map((word) => word.end));

  if (backgroundBegin < mainBegin - TIMING_EPSILON) return { position: "front" };
  if (backgroundBegin >= mainEnd - TIMING_EPSILON) return { position: "end" };

  // Background content only sits inside the line when it fits entirely within a pause in the main words.
  const gapIndex = mainWords.findIndex((word, index) => {
    const next = mainWords[index + 1];
    return (
      next !== undefined && backgroundBegin >= word.end - TIMING_EPSILON && backgroundEnd <= next.begin + TIMING_EPSILON
    );
  });
  return gapIndex === -1 ? { position: "end" } : { position: "middle", afterWordIndex: gapIndex };
}

export { alternateBackgroundPlacement };
export type { BackgroundPlacement };

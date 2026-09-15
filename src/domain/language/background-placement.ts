import type { LyricLine } from "@/domain/line/model";

type BackgroundPlacement = { position: "front" } | { position: "middle"; afterWordIndex: number } | { position: "end" };

const TIMING_EPSILON = 1e-4;

function distanceToGap(time: number, gapBegin: number, gapEnd: number): number {
  if (time < gapBegin) return gapBegin - time;
  if (time > gapEnd) return time - gapEnd;
  return 0;
}

function alternateBackgroundPlacement(line: LyricLine): BackgroundPlacement {
  const mainWords = line.words;
  const backgroundWords = line.backgroundWords;
  if (!mainWords?.length || !backgroundWords?.length) return { position: "end" };

  const mainBegin = Math.min(...mainWords.map((word) => word.begin));
  const mainEnd = Math.max(...mainWords.map((word) => word.end));
  const backgroundBegin = Math.min(...backgroundWords.map((word) => word.begin));

  if (backgroundBegin < mainBegin - TIMING_EPSILON) return { position: "front" };
  if (backgroundBegin >= mainEnd - TIMING_EPSILON) return { position: "end" };

  const gaps = mainWords.flatMap((word, index) => {
    const next = mainWords[index + 1];
    return next && next.begin > word.end + TIMING_EPSILON
      ? [{ afterWordIndex: index, begin: word.end, end: next.begin }]
      : [];
  });
  if (gaps.length === 0) return { position: "end" };

  const closest = gaps.reduce((best, gap) =>
    distanceToGap(backgroundBegin, gap.begin, gap.end) < distanceToGap(backgroundBegin, best.begin, best.end)
      ? gap
      : best,
  );
  return { position: "middle", afterWordIndex: closest.afterWordIndex };
}

export { alternateBackgroundPlacement };
export type { BackgroundPlacement };

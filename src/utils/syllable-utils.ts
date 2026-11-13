import type { SubPartition } from "@/utils/word-timing";

// -- Helpers ------------------------------------------------------------------

function distributeTiming(text: string, splitPoints: number[], begin: number, end: number): SubPartition[] {
  const parts: string[] = [];
  let lastIdx = 0;

  const sortedPoints = splitPoints.toSorted((a, b) => a - b);
  for (const point of sortedPoints) {
    if (point > lastIdx && point < text.length) {
      parts.push(text.slice(lastIdx, point));
      lastIdx = point;
    }
  }
  parts.push(text.slice(lastIdx));

  const duration = end - begin;
  const charDuration = duration / text.length;

  let currentBegin = begin;
  return parts.map((part, index) => {
    const partEnd = index === parts.length - 1 ? end : currentBegin + part.length * charDuration;
    const timing: SubPartition = {
      text: part,
      begin: currentBegin,
      end: partEnd,
    };
    currentBegin = partEnd;
    return timing;
  });
}

// -- Exports ------------------------------------------------------------------

export { distributeTiming };

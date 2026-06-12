import type { WordTiming } from "@/domain/word/timing";

function wordsOverlap(a: WordTiming, b: WordTiming): boolean {
  return a.begin < b.end && a.end > b.begin;
}

export { wordsOverlap };

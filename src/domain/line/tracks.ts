import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";

type WordTrack = "word" | "bg";

function trackWords(line: LyricLine, type: WordTrack): WordTiming[] | undefined {
  return type === "word" ? line.words : line.backgroundWords;
}

export { trackWords };

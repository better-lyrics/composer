import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";

type WordTrack = "word" | "bg";
type TrackField = "words" | "backgroundWords";

function trackField(type: WordTrack): TrackField {
  return type === "word" ? "words" : "backgroundWords";
}

function trackWords(line: LyricLine, type: WordTrack): WordTiming[] | undefined {
  return line[trackField(type)];
}

export { trackField, trackWords };

import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { LyricLine } from "@/domain/line/model";

type LanguageReviewTrack = { kind: "transliteration" } | { kind: "translation"; language: string };

interface LanguageReviewItem {
  lineId: string;
  lineIndex: number;
  text: string;
  tracks: LanguageReviewTrack[];
}

function getLanguageReviewTracks(line: LyricLine): LanguageReviewTrack[] {
  const fingerprint = languageSourceFingerprint(line.text, line.backgroundText);
  const tracks: LanguageReviewTrack[] = [];

  if (
    line.transliteration &&
    (line.transliteration.sourceFingerprint !== fingerprint ||
      line.transliteration.alignmentStatus === "needs-review" ||
      line.transliteration.backgroundAlignmentStatus === "needs-review")
  ) {
    tracks.push({ kind: "transliteration" });
  }
  for (const [language, translation] of Object.entries(line.translations ?? {})) {
    if (translation.sourceFingerprint !== fingerprint) {
      tracks.push({ kind: "translation", language });
    }
  }

  return tracks;
}

function getLanguageReviewItems(lines: LyricLine[]): LanguageReviewItem[] {
  return lines.flatMap((line, lineIndex) => {
    const tracks = getLanguageReviewTracks(line);
    return tracks.length > 0 ? [{ lineId: line.id, lineIndex, text: line.text, tracks }] : [];
  });
}

function languageLineAnchorId(lineId: string): string {
  return `language-line-${lineId}`;
}

export { getLanguageReviewItems, getLanguageReviewTracks, languageLineAnchorId };
export type { LanguageReviewItem, LanguageReviewTrack };

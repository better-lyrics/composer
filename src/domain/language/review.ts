import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { TransliterationTrack } from "@/domain/language/model";
import type { LyricLine } from "@/domain/line/model";

type LanguageReviewReason = "source-changed" | "alignment";
type LanguageReviewTrack = ({ kind: "transliteration" } | { kind: "translation"; language: string }) & {
  reasons: LanguageReviewReason[];
};

function isTransliterationSourceStale(line: LyricLine, field: "words" | "backgroundWords"): boolean {
  const track = line.transliteration;
  if (!track || !(field === "words" ? track.text : track.backgroundText)) return false;
  const fingerprint = languageSourceFingerprint(line.text, line.backgroundText);
  const reviewed = field === "words" ? track.reviewedSourceFingerprint : track.backgroundReviewedSourceFingerprint;
  return track.sourceFingerprint !== fingerprint && reviewed !== fingerprint;
}

function confirmTransliterationAlignment(
  line: LyricLine,
  field: "words" | "backgroundWords",
): TransliterationTrack | undefined {
  if (!line.transliteration) return undefined;
  const fingerprint = languageSourceFingerprint(line.text, line.backgroundText);
  const track: TransliterationTrack = {
    ...line.transliteration,
    ...(field === "words"
      ? { alignmentStatus: "confirmed", reviewedSourceFingerprint: fingerprint }
      : { backgroundAlignmentStatus: "confirmed", backgroundReviewedSourceFingerprint: fingerprint }),
  };
  const reviewedLine = { ...line, transliteration: track };
  if (
    !isTransliterationSourceStale(reviewedLine, "words") &&
    !isTransliterationSourceStale(reviewedLine, "backgroundWords")
  ) {
    track.sourceFingerprint = fingerprint;
    track.stale = undefined;
    track.reviewedSourceFingerprint = undefined;
    track.backgroundReviewedSourceFingerprint = undefined;
  }
  return track;
}

interface LanguageReviewItem {
  lineId: string;
  lineIndex: number;
  text: string;
  tracks: LanguageReviewTrack[];
}

function getLanguageReviewTracks(line: LyricLine): LanguageReviewTrack[] {
  const fingerprint = languageSourceFingerprint(line.text, line.backgroundText);
  const tracks: LanguageReviewTrack[] = [];

  if (line.transliteration) {
    const reasons: LanguageReviewReason[] = [];
    if (isTransliterationSourceStale(line, "words") || isTransliterationSourceStale(line, "backgroundWords")) {
      reasons.push("source-changed");
    }
    if (
      line.transliteration.alignmentStatus === "needs-review" ||
      line.transliteration.backgroundAlignmentStatus === "needs-review"
    ) {
      reasons.push("alignment");
    }
    if (reasons.length > 0) tracks.push({ kind: "transliteration", reasons });
  }
  for (const [language, translation] of Object.entries(line.translations ?? {})) {
    if (translation.sourceFingerprint !== fingerprint) {
      tracks.push({ kind: "translation", language, reasons: ["source-changed"] });
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

export {
  confirmTransliterationAlignment,
  getLanguageReviewItems,
  getLanguageReviewTracks,
  isTransliterationSourceStale,
  languageLineAnchorId,
};
export type { LanguageReviewTrack };

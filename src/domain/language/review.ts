import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { lineTranslations, lineTransliteration, withLanguages } from "@/domain/language/line-languages";
import type { LanguageSide, LineLanguage } from "@/domain/language/model";
import type { LyricLine } from "@/domain/line/model";

type LanguageReviewReason = "source-changed" | "alignment";
type LanguageReviewTrack = ({ kind: "transliteration" } | { kind: "translation"; language: string }) & {
  reasons: LanguageReviewReason[];
};

function fieldSide(field: "words" | "backgroundWords"): LanguageSide {
  return field === "words" ? "main" : "bg";
}

function isTransliterationSourceStale(line: LyricLine, field: "words" | "backgroundWords"): boolean {
  const track = lineTransliteration(line);
  const side = track?.[fieldSide(field)];
  if (!track || !side?.text) return false;
  const fingerprint = languageSourceFingerprint(line.text, line.backgroundText);
  return track.sourceFingerprint !== fingerprint && side.reviewedSourceFingerprint !== fingerprint;
}

function confirmTransliterationAlignment(
  line: LyricLine,
  field: "words" | "backgroundWords",
): LineLanguage | undefined {
  const current = lineTransliteration(line);
  if (!current) return undefined;
  const fingerprint = languageSourceFingerprint(line.text, line.backgroundText);
  const side = fieldSide(field);
  const track: LineLanguage = {
    ...current,
    [side]: { ...current[side], alignmentStatus: "confirmed", reviewedSourceFingerprint: fingerprint },
  };
  const reviewedLine = { ...line, ...withLanguages(line, { transliteration: track }) };
  if (
    !isTransliterationSourceStale(reviewedLine, "words") &&
    !isTransliterationSourceStale(reviewedLine, "backgroundWords")
  ) {
    return {
      ...track,
      sourceFingerprint: fingerprint,
      stale: undefined,
      main: { ...track.main, reviewedSourceFingerprint: undefined },
      ...(track.bg && { bg: { ...track.bg, reviewedSourceFingerprint: undefined } }),
    };
  }
  return track;
}

interface LanguageReviewItem {
  lineId: string;
  lineIndex: number;
  text: string;
  tracks: LanguageReviewTrack[];
}

function alignmentNeedsReview(track: LineLanguage | undefined, part: "main" | "background"): boolean {
  const status = part === "main" ? track?.main.alignmentStatus : track?.bg?.alignmentStatus;
  return status === "needs-review";
}

function getLanguageReviewTracks(line: LyricLine): LanguageReviewTrack[] {
  const fingerprint = languageSourceFingerprint(line.text, line.backgroundText);
  const tracks: LanguageReviewTrack[] = [];

  const transliteration = lineTransliteration(line);
  if (transliteration) {
    const reasons: LanguageReviewReason[] = [];
    if (isTransliterationSourceStale(line, "words") || isTransliterationSourceStale(line, "backgroundWords")) {
      reasons.push("source-changed");
    }
    if (alignmentNeedsReview(transliteration, "main") || alignmentNeedsReview(transliteration, "background")) {
      reasons.push("alignment");
    }
    if (reasons.length > 0) tracks.push({ kind: "transliteration", reasons });
  }
  for (const [language, translation] of Object.entries(lineTranslations(line) ?? {})) {
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
  alignmentNeedsReview,
  confirmTransliterationAlignment,
  getLanguageReviewItems,
  getLanguageReviewTracks,
  isTransliterationSourceStale,
  languageLineAnchorId,
};
export type { LanguageReviewTrack };

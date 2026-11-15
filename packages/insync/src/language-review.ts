import { backgroundText, lineText } from "./line-text";
import { languageSourceFingerprint } from "./language-fingerprint";
import { lineTranslations, lineTransliteration, withLanguages } from "./language-line-languages";
import type { LanguageSide, LineLanguage } from "./language";
import type { LyricLine } from "./line";

type LanguageReviewReason = "source-changed" | "alignment";
type LanguageReviewTrack = ({ kind: "transliteration" } | { kind: "translation"; language: string }) & {
  reasons: LanguageReviewReason[];
};

function fieldSide(field: "words" | "backgroundWords"): LanguageSide {
  return field === "words" ? "main" : "bg";
}

function isTransliterationSourceStale(line: LyricLine, field: "words" | "backgroundWords", splitChar: string): boolean {
  const track = lineTransliteration(line);
  const side = track?.[fieldSide(field)];
  if (!track || !side?.text) return false;
  const fingerprint = languageSourceFingerprint(splitChar, lineText(line, splitChar), backgroundText(line, splitChar));
  return track.sourceFingerprint !== fingerprint && side.reviewedSourceFingerprint !== fingerprint;
}

function confirmTransliterationAlignment(
  line: LyricLine,
  field: "words" | "backgroundWords",
  splitChar: string,
): LineLanguage | undefined {
  const current = lineTransliteration(line);
  if (!current) return undefined;
  const fingerprint = languageSourceFingerprint(splitChar, lineText(line, splitChar), backgroundText(line, splitChar));
  const side = fieldSide(field);
  const track: LineLanguage = {
    ...current,
    [side]: { ...current[side], alignmentStatus: "confirmed", reviewedSourceFingerprint: fingerprint },
  };
  const reviewedLine = { ...line, ...withLanguages(line, { transliteration: track }) };
  if (
    !isTransliterationSourceStale(reviewedLine, "words", splitChar) &&
    !isTransliterationSourceStale(reviewedLine, "backgroundWords", splitChar)
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

function getLanguageReviewTracks(line: LyricLine, splitChar: string): LanguageReviewTrack[] {
  const fingerprint = languageSourceFingerprint(splitChar, lineText(line, splitChar), backgroundText(line, splitChar));
  const tracks: LanguageReviewTrack[] = [];

  const transliteration = lineTransliteration(line);
  if (transliteration) {
    const reasons: LanguageReviewReason[] = [];
    if (
      isTransliterationSourceStale(line, "words", splitChar) ||
      isTransliterationSourceStale(line, "backgroundWords", splitChar)
    ) {
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

function getLanguageReviewItems(lines: LyricLine[], splitChar: string): LanguageReviewItem[] {
  return lines.flatMap((line, lineIndex) => {
    const tracks = getLanguageReviewTracks(line, splitChar);
    return tracks.length > 0 ? [{ lineId: line.id, lineIndex, text: lineText(line, splitChar), tracks }] : [];
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

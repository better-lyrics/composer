// -- Alternate-language content ----------------------------------------------

type LanguageContentOrigin = "google" | "import" | "manual";

type TransliterationAlignmentStatus = "confirmed" | "inferred" | "needs-review" | "unresolved";

interface LanguageContentMeta {
  origin: LanguageContentOrigin;
  sourceFingerprint: string;
  stale?: boolean;
}

interface TransliterationSegment {
  original: string;
  transliteration: string;
}

interface TransliterationTrack extends LanguageContentMeta {
  language: string;
  text: string;
  backgroundText?: string;
  segments: TransliterationSegment[];
  backgroundSegments?: TransliterationSegment[];
  /** The mapping itself lives on WordTiming.transliteration. */
  alignmentStatus?: TransliterationAlignmentStatus;
  backgroundAlignmentStatus?: TransliterationAlignmentStatus;
}

interface TranslationTrack extends LanguageContentMeta {
  language: string;
  text: string;
  backgroundText?: string;
}

type TranslationTracks = Record<string, TranslationTrack>;

export type {
  LanguageContentMeta,
  LanguageContentOrigin,
  TransliterationAlignmentStatus,
  TranslationTrack,
  TranslationTracks,
  TransliterationSegment,
  TransliterationTrack,
};

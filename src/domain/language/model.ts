// -- Alternate-language content ----------------------------------------------

type LanguageContentOrigin = "google" | "import" | "manual";

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
  TranslationTrack,
  TranslationTracks,
  TransliterationSegment,
  TransliterationTrack,
};

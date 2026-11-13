// -- Alternate-language content ----------------------------------------------

type LanguageContentOrigin = "google" | "import" | "manual";

/** Confirmed requires manual alignment; inferred is automatically accepted without a review warning. */
type TransliterationAlignmentStatus = "confirmed" | "inferred" | "needs-review" | "unresolved";

type LanguageSide = "main" | "bg";

interface LanguageContentMeta {
  origin: LanguageContentOrigin;
  sourceFingerprint: string;
  stale?: boolean;
}

interface TransliterationSegment {
  original: string;
  transliteration: string;
}

/** The reading of one syllable, and the exact separator to restore after it when syllables merge. */
interface LanguagePiece {
  text?: string;
  joinerAfter?: string;
}

/** Pieces by syllable id. A cache of the track text: the text is the truth. */
type LanguagePieces = Readonly<Record<string, LanguagePiece>>;

interface TrackLanguage {
  text: string;
  segments?: TransliterationSegment[];
  pieces?: LanguagePieces;
  alignmentStatus?: TransliterationAlignmentStatus;
  /** Source acknowledged by manually aligning this side while the other may still be stale. */
  reviewedSourceFingerprint?: string;
}

/** Saved records can hold background segments or a status with no background text, so the text is optional here. */
type BackgroundLanguage = Omit<TrackLanguage, "text"> & { text?: string };

interface LineLanguage extends LanguageContentMeta {
  language: string;
  main: TrackLanguage;
  bg?: BackgroundLanguage;
}

type LineTranslations = Record<string, LineLanguage>;

/** Syllable readings a saved line holds with no romanization; kept only so a save writes them back. */
interface HeldReadings {
  main?: LanguagePieces;
  bg?: LanguagePieces;
}

interface LineLanguages {
  translations?: LineTranslations;
  transliteration?: LineLanguage;
  heldReadings?: HeldReadings;
}

export type {
  BackgroundLanguage,
  HeldReadings,
  LanguageContentMeta,
  LanguageContentOrigin,
  LanguagePiece,
  LanguagePieces,
  LanguageSide,
  LineLanguage,
  LineLanguages,
  LineTranslations,
  TrackLanguage,
  TransliterationAlignmentStatus,
  TransliterationSegment,
};

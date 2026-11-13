import type {
  BackgroundLanguage,
  LanguageContentMeta,
  LanguagePiece,
  LanguageSide,
  LineLanguage,
  LineLanguages,
  TrackLanguage,
  TransliterationAlignmentStatus,
  TransliterationSegment,
} from "@/domain/language/model";
import { keyedPieces, type PositionalPieces, positionalPieces } from "@/domain/language/pieces";
import { sidePieces, withPiecesOn } from "@/domain/language/side-pieces";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

// Languages as version 3 records, links and project files spell them: one object per kind with flat
// background fields, and each syllable's reading on the saved word itself.

interface V3TranslationTrack extends LanguageContentMeta {
  language: string;
  text: string;
  backgroundText?: string;
}

interface V3TransliterationTrack extends V3TranslationTrack {
  segments?: TransliterationSegment[];
  backgroundSegments?: TransliterationSegment[];
  alignmentStatus?: TransliterationAlignmentStatus;
  backgroundAlignmentStatus?: TransliterationAlignmentStatus;
  reviewedSourceFingerprint?: string;
  backgroundReviewedSourceFingerprint?: string;
}

interface V3LanguageFields {
  translations?: Record<string, V3TranslationTrack>;
  transliteration?: V3TransliterationTrack;
}

interface V3Piece {
  transliteration?: string;
  transliterationJoinerAfter?: string;
}

interface V3TrackPieces {
  main: PositionalPieces | undefined;
  bg: PositionalPieces | undefined;
}

interface StoreWords {
  words: readonly WordTiming[] | undefined;
  backgroundWords: readonly WordTiming[] | undefined;
}

// -- Pieces -------------------------------------------------------------------

function pieceFromV3({ transliteration, transliterationJoinerAfter }: V3Piece): LanguagePiece | undefined {
  if (transliteration === undefined && transliterationJoinerAfter === undefined) return undefined;
  return {
    ...(transliteration !== undefined && { text: transliteration }),
    ...(transliterationJoinerAfter !== undefined && { joinerAfter: transliterationJoinerAfter }),
  };
}

function v3Piece(piece: LanguagePiece | undefined): V3Piece {
  return {
    ...(piece?.text !== undefined && { transliteration: piece.text }),
    ...(piece?.joinerAfter !== undefined && { transliterationJoinerAfter: piece.joinerAfter }),
  };
}

function withoutV3Piece<T extends V3Piece>({
  transliteration: _text,
  transliterationJoinerAfter: _joiner,
  ...word
}: T): Omit<T, keyof V3Piece> {
  return word;
}

function v3PiecesOf(words: readonly V3Piece[] | undefined): PositionalPieces | undefined {
  return words?.map(pieceFromV3);
}

function v3WordPieces(
  words: readonly WordTiming[] | undefined,
  languages: LineLanguages | undefined,
  side: LanguageSide,
): V3Piece[] | undefined {
  return words && positionalPieces(words, sidePieces(languages, side)).map(v3Piece);
}

// -- Tracks -------------------------------------------------------------------

function sideLanguage(
  segments: TransliterationSegment[] | undefined,
  alignmentStatus: TransliterationAlignmentStatus | undefined,
  reviewedSourceFingerprint: string | undefined,
): Omit<TrackLanguage, "text"> {
  return {
    ...(segments !== undefined && { segments }),
    ...(alignmentStatus !== undefined && { alignmentStatus }),
    ...(reviewedSourceFingerprint !== undefined && { reviewedSourceFingerprint }),
  };
}

function lineLanguageFromV3(track: V3TranslationTrack | V3TransliterationTrack): LineLanguage {
  const full: Partial<V3TransliterationTrack> = track;
  const { language, origin, sourceFingerprint, stale, text, backgroundText } = track;
  const bg: BackgroundLanguage = {
    ...(backgroundText !== undefined && { text: backgroundText }),
    ...sideLanguage(full.backgroundSegments, full.backgroundAlignmentStatus, full.backgroundReviewedSourceFingerprint),
  };
  return {
    language,
    main: { text, ...sideLanguage(full.segments, full.alignmentStatus, full.reviewedSourceFingerprint) },
    ...(Object.keys(bg).length > 0 && { bg }),
    origin,
    sourceFingerprint,
    ...(stale !== undefined && { stale }),
  };
}

function v3Translation({ language, main, bg, origin, sourceFingerprint, stale }: LineLanguage): V3TranslationTrack {
  return {
    language,
    text: main.text,
    ...(bg?.text !== undefined && { backgroundText: bg.text }),
    origin,
    sourceFingerprint,
    ...(stale !== undefined && { stale }),
  };
}

function v3Transliteration(language: LineLanguage): V3TransliterationTrack {
  const { main, bg } = language;
  return {
    ...v3Translation(language),
    ...(main.segments && { segments: main.segments }),
    ...(bg?.segments && { backgroundSegments: bg.segments }),
    ...(main.alignmentStatus !== undefined && { alignmentStatus: main.alignmentStatus }),
    ...(bg?.alignmentStatus !== undefined && { backgroundAlignmentStatus: bg.alignmentStatus }),
    ...(main.reviewedSourceFingerprint !== undefined && { reviewedSourceFingerprint: main.reviewedSourceFingerprint }),
    ...(bg?.reviewedSourceFingerprint !== undefined && {
      backgroundReviewedSourceFingerprint: bg.reviewedSourceFingerprint,
    }),
  };
}

// -- Lines --------------------------------------------------------------------

function languagesFromV3(
  { translations, transliteration }: V3LanguageFields,
  pieces: V3TrackPieces,
  words: StoreWords,
): LineLanguages | undefined {
  const languages: LineLanguages = {
    ...(translations && {
      translations: Object.fromEntries(
        Object.entries(translations).map(([tag, track]) => [tag, lineLanguageFromV3(track)]),
      ),
    }),
    ...(transliteration && { transliteration: lineLanguageFromV3(transliteration) }),
  };
  const mainPieces = words.words && pieces.main && keyedPieces(words.words, pieces.main);
  const bgPieces = words.backgroundWords && pieces.bg && keyedPieces(words.backgroundWords, pieces.bg);
  return withPiecesOn(withPiecesOn(languages, "main", mainPieces), "bg", bgPieces);
}

function v3Languages(languages: LineLanguages | undefined): V3LanguageFields {
  return {
    ...(languages?.translations && {
      translations: Object.fromEntries(
        Object.entries(languages.translations).map(([tag, track]) => [tag, v3Translation(track)]),
      ),
    }),
    ...(languages?.transliteration && { transliteration: v3Transliteration(languages.transliteration) }),
  };
}

// -- Exports ------------------------------------------------------------------

export type { V3LanguageFields, V3Piece, V3TranslationTrack, V3TransliterationTrack };
export { languagesFromV3, lineLanguageFromV3, v3Languages, v3PiecesOf, v3WordPieces, withoutV3Piece };

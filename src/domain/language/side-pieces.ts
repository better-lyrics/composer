import type {
  BackgroundLanguage,
  LanguagePieces,
  LanguageSide,
  LineLanguage,
  LineLanguages,
} from "@/domain/language/model";

// -- Track sides --------------------------------------------------------------

function withSidePieces<T extends BackgroundLanguage>(track: T, pieces: LanguagePieces | undefined): T {
  const { pieces: _old, ...rest } = track;
  return (pieces ? { ...rest, pieces } : rest) as T;
}

// A side the language does not have holds no pieces, and a background side left with nothing is no side.
function withTrackPieces(language: LineLanguage, side: LanguageSide, pieces: LanguagePieces | undefined): LineLanguage {
  if (side === "main") return { ...language, main: withSidePieces(language.main, pieces) };
  if (!language.bg) return language;
  const { bg: _bg, ...rest } = language;
  const bg = withSidePieces(language.bg, pieces);
  return Object.keys(bg).length ? { ...rest, bg } : rest;
}

function withoutPieces(language: LineLanguage): LineLanguage {
  return withTrackPieces(withTrackPieces(language, "main", undefined), "bg", undefined);
}

function hasTrackSide(track: LineLanguage | undefined, side: LanguageSide): track is LineLanguage {
  return !!track && (side === "main" || !!track.bg);
}

// -- Reader and writer --------------------------------------------------------

// A side's pieces live on the romanization's side when it has one, else they are held for the next save.
function sidePieces(languages: LineLanguages | undefined, side: LanguageSide): LanguagePieces | undefined {
  const track = languages?.transliteration;
  return hasTrackSide(track, side) ? track[side]?.pieces : languages?.heldReadings?.[side];
}

function withPiecesOn(
  languages: LineLanguages | undefined,
  side: LanguageSide,
  pieces: LanguagePieces | undefined,
): LineLanguages | undefined {
  const track = languages?.transliteration;
  const onTrack = hasTrackSide(track, side);
  const { [side]: _held, ...otherHeld } = languages?.heldReadings ?? {};
  const held = !onTrack && pieces ? { ...otherHeld, [side]: pieces } : otherHeld;
  const { heldReadings: _heldReadings, ...rest } = languages ?? {};
  const next: LineLanguages = {
    ...rest,
    ...(onTrack && { transliteration: withTrackPieces(track, side, pieces) }),
    ...(Object.keys(held).length > 0 && { heldReadings: held }),
  };
  return Object.keys(next).length ? next : undefined;
}

// -- Exports ------------------------------------------------------------------

export { sidePieces, withoutPieces, withPiecesOn, withSidePieces, withTrackPieces };

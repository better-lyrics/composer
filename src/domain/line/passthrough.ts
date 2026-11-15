import type { Passthrough } from "insync/passthrough";
import type { LineTrack, LyricLine, Syllable } from "insync/line";
import { backgroundTrack, isTimedSyllable, mainTrack } from "insync/line-track";
import { withBackgroundTrack, withMainTrack } from "@/domain/line/track-writes";

// -- Types --------------------------------------------------------------------

interface KeptSyllable {
  readonly text: string;
  readonly passthrough: Passthrough;
}

// By position among a track's untimed syllables, which a rebuild makes again from text.
type UntimedPassthrough = readonly (KeptSyllable | null)[];

// What a line's `<p>`, its x-bg container and its untimed spans carried from TTML.
interface LinePassthrough {
  readonly line?: Passthrough;
  readonly background?: Passthrough;
  readonly mainUntimed?: UntimedPassthrough;
  readonly backgroundUntimed?: UntimedPassthrough;
}

// -- Helpers ------------------------------------------------------------------

function untimedPassthroughOf(track: LineTrack | undefined): UntimedPassthrough | undefined {
  const untimed = track?.syllables.filter((syllable) => !isTimedSyllable(syllable)) ?? [];
  if (!untimed.some((syllable) => syllable.passthrough)) return undefined;
  return untimed.map(({ text, passthrough }) => (passthrough ? { text, passthrough } : null));
}

// A rebuilt untimed syllable takes back the passthrough of the one in its place when their text is the same.
function withUntimedPassthrough<T extends LineTrack>(track: T, kept: UntimedPassthrough | undefined): T {
  if (!kept) return track;
  let untimedIndex = 0;
  const restore = <S extends Syllable>(syllable: S): S => {
    if (isTimedSyllable(syllable)) return syllable;
    const keptSyllable = kept[untimedIndex++];
    return keptSyllable && keptSyllable.text === syllable.text
      ? { ...syllable, passthrough: keptSyllable.passthrough }
      : syllable;
  };
  return { ...track, syllables: track.syllables.map(restore) };
}

// -- Functions ----------------------------------------------------------------

// Kept elements of the line or its background placed after a syllable, which they find again by its id.
function placesKeptElements(line: LyricLine): boolean {
  return !!(line.passthrough?.elementsAfter || backgroundTrack(line)?.passthrough?.elementsAfter);
}

function linePassthroughOf(line: LyricLine): LinePassthrough | undefined {
  const background = backgroundTrack(line)?.passthrough;
  const mainUntimed = untimedPassthroughOf(mainTrack(line));
  const backgroundUntimed = untimedPassthroughOf(backgroundTrack(line));
  if (!line.passthrough && !background && !mainUntimed && !backgroundUntimed) return undefined;
  return {
    ...(line.passthrough && { line: line.passthrough }),
    ...(background && { background }),
    ...(mainUntimed && { mainUntimed }),
    ...(backgroundUntimed && { backgroundUntimed }),
  };
}

// A line rebuilt from fields takes back what its source line carried; a background it no longer has takes nothing.
function withLinePassthrough(line: LyricLine, kept: LinePassthrough | undefined): LyricLine {
  if (!kept) return line;
  const withMain = kept.mainUntimed
    ? withMainTrack(line, withUntimedPassthrough(mainTrack(line), kept.mainUntimed))
    : line;
  const background = backgroundTrack(withMain);
  const keptBackground =
    background &&
    withUntimedPassthrough(
      kept.background ? { ...background, passthrough: kept.background } : background,
      kept.backgroundUntimed,
    );
  const withBackground = keptBackground ? withBackgroundTrack(withMain, keptBackground) : withMain;
  return kept.line ? { ...withBackground, passthrough: kept.line } : withBackground;
}

function trackWithoutKeptData<T extends LineTrack>(track: T): T {
  if (!track.syllables.some((syllable) => syllable.passthrough)) return track;
  return {
    ...track,
    syllables: track.syllables.map((syllable) =>
      syllable.passthrough ? { ...syllable, passthrough: undefined } : syllable,
    ),
  };
}

// The line as Composer models it, without anything kept from TTML.
function withoutKeptData(line: LyricLine): LyricLine {
  const background = backgroundTrack(line);
  const bare = withMainTrack(
    withBackgroundTrack(
      line,
      background &&
        trackWithoutKeptData(background.passthrough ? { ...background, passthrough: undefined } : background),
    ),
    trackWithoutKeptData(mainTrack(line)),
  );
  return bare.passthrough ? { ...bare, passthrough: undefined } : bare;
}

// -- Exports ------------------------------------------------------------------

export type { LinePassthrough };
export { linePassthroughOf, placesKeptElements, withLinePassthrough, withoutKeptData };

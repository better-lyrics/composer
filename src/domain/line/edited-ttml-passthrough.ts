import type { BackgroundTrack, LineTrack, LyricLine, Syllable } from "@/domain/line/model";
import { linePassthroughOf, withLinePassthrough, withoutKeptData } from "@/domain/line/passthrough";
import { backgroundTrack, isTimedSyllable, mainTrack, timedSyllables } from "@/domain/line/track";
import { withBackgroundTrack, withMainTrack } from "@/domain/line/track-writes";
import { withSpansFromMarkup } from "@/utils/lyrics-parsers/ttml-untimed-read";

// -- Helpers ------------------------------------------------------------------

function hasKeptData(line: LyricLine): boolean {
  return (
    line.passthrough !== undefined ||
    line.tracks.some(
      (track) =>
        (track.role === "bg" && track.passthrough !== undefined) ||
        track.syllables.some((syllable) => syllable.passthrough !== undefined),
    )
  );
}

// Timed syllables pair by position: the merge keeps the edited line's timed syllable count.
function withTimedPassthroughOf<T extends LineTrack>(track: T, source: LineTrack | undefined): T {
  const kept = timedSyllables(source);
  if (!kept.some((syllable) => syllable.passthrough)) return track;
  let timedIndex = 0;
  const restore = <S extends Syllable>(syllable: S): S => {
    if (!isTimedSyllable(syllable)) return syllable;
    const passthrough = kept[timedIndex++]?.passthrough;
    return passthrough ? { ...syllable, passthrough } : syllable;
  };
  return { ...track, syllables: track.syllables.map(restore) };
}

// A background with no timed syllables exports as one timed span holding its kept spans; an edited file reads them
// back as that span's markup.
function withSpanMarkupOf(track: BackgroundTrack, edited: BackgroundTrack | undefined): BackgroundTrack {
  const [span, ...rest] = timedSyllables(edited);
  const markup = span?.passthrough?.markup;
  return markup && rest.length === 0 && timedSyllables(track).length === 0 ? withSpansFromMarkup(track, markup) : track;
}

// -- Functions ----------------------------------------------------------------

// The edited file decides what a merged line keeps from TTML: everything the line had is replaced, node by node.
function withKeptDataOf(line: LyricLine, edited: LyricLine): LyricLine {
  if (!hasKeptData(line) && !hasKeptData(edited)) return line;
  const bare = withoutKeptData(line);
  const background = backgroundTrack(bare);
  const timed = withBackgroundTrack(
    withMainTrack(bare, withTimedPassthroughOf(mainTrack(bare), mainTrack(edited))),
    background && withTimedPassthroughOf(background, backgroundTrack(edited)),
  );
  const kept = withLinePassthrough(timed, linePassthroughOf(edited));
  const keptBackground = backgroundTrack(kept);
  return keptBackground ? withBackgroundTrack(kept, withSpanMarkupOf(keptBackground, backgroundTrack(edited))) : kept;
}

// -- Exports ------------------------------------------------------------------

export { hasKeptData, withKeptDataOf };

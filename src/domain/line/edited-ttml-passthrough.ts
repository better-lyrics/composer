import type { LineTrack, LyricLine, Syllable } from "@/domain/line/model";
import { linePassthroughOf, withLinePassthrough, withoutKeptData } from "@/domain/line/passthrough";
import { backgroundTrack, isTimedSyllable, mainTrack, timedSyllables } from "@/domain/line/track";
import { withBackgroundTrack, withMainTrack } from "@/domain/line/track-writes";

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
  return withLinePassthrough(timed, linePassthroughOf(edited));
}

// -- Exports ------------------------------------------------------------------

export { hasKeptData, withKeptDataOf };

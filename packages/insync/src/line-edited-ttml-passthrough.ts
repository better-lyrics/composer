import { withRenamedAnchors } from "./passthrough";
import type { BackgroundTrack, LineTrack, LyricLine, Syllable } from "./line";
import { type LinePassthrough, linePassthroughOf, withLinePassthrough, withoutKeptData } from "./line-passthrough";
import { backgroundTrack, isTimedSyllable, mainTrack, timedSyllables } from "./line-track";
import { withBackgroundTrack, withMainTrack } from "./line-track-writes";
import { withSpansFromMarkup } from "./ttml/untimed-read";

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

// A background with no timed syllables exports as one timed span holding its kept spans, or carrying the attributes
// of the one kept span that held all of it; an edited file reads them back as that span's markup or attributes.
function withSpanMarkupOf(
  track: BackgroundTrack,
  edited: BackgroundTrack | undefined,
  splitChar: string,
): BackgroundTrack {
  const [span, ...rest] = timedSyllables(edited);
  if (!span || rest.length > 0 || timedSyllables(track).length > 0) return track;
  const { markup, attrs } = span.passthrough ?? {};
  if (markup) return withSpansFromMarkup(track, markup, splitChar);
  return attrs
    ? withSpansFromMarkup(track, [{ name: "span", attrs, children: [{ text: span.text }] }], splitChar)
    : track;
}

// Kept elements follow syllables by id; an edited track's timed syllables pair with the merged one's by position.
function timedIdsOn(edited: LineTrack | undefined, merged: LineTrack | undefined): Map<string, string> {
  const mergedTimed = timedSyllables(merged);
  return new Map(
    timedSyllables(edited).flatMap((syllable, index) => {
      const partner = mergedTimed[index];
      return partner ? [[syllable.id, partner.id] as const] : [];
    }),
  );
}

function withAnchorsOn(kept: LinePassthrough | undefined, edited: LyricLine, merged: LyricLine) {
  if (!kept) return kept;
  return {
    ...kept,
    ...(kept.line && { line: withRenamedAnchors(kept.line, timedIdsOn(mainTrack(edited), mainTrack(merged))) }),
    ...(kept.background && {
      background: withRenamedAnchors(kept.background, timedIdsOn(backgroundTrack(edited), backgroundTrack(merged))),
    }),
  };
}

// -- Functions ----------------------------------------------------------------

// The edited file decides what a merged line keeps from TTML: everything the line had is replaced, node by node.
function withKeptDataOf(line: LyricLine, edited: LyricLine, splitChar: string): LyricLine {
  if (!hasKeptData(line) && !hasKeptData(edited)) return line;
  const bare = withoutKeptData(line);
  const background = backgroundTrack(bare);
  const timed = withBackgroundTrack(
    withMainTrack(bare, withTimedPassthroughOf(mainTrack(bare), mainTrack(edited))),
    background && withTimedPassthroughOf(background, backgroundTrack(edited)),
  );
  const kept = withLinePassthrough(timed, withAnchorsOn(linePassthroughOf(edited), edited, timed));
  const keptBackground = backgroundTrack(kept);
  return keptBackground
    ? withBackgroundTrack(kept, withSpanMarkupOf(keptBackground, backgroundTrack(edited), splitChar))
    : kept;
}

// -- Exports ------------------------------------------------------------------

export { hasKeptData, withKeptDataOf };

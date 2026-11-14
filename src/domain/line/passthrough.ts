import type { Passthrough } from "insync/passthrough";
import type { LineTrack, LyricLine } from "@/domain/line/model";
import { backgroundTrack, mainTrack } from "@/domain/line/track";
import { withBackgroundTrack, withMainTrack } from "@/domain/line/track-writes";

// -- Types --------------------------------------------------------------------

// What a line's `<p>` and its x-bg container carried from TTML.
interface LinePassthrough {
  readonly line?: Passthrough;
  readonly background?: Passthrough;
}

// -- Functions ----------------------------------------------------------------

function linePassthroughOf(line: LyricLine): LinePassthrough | undefined {
  const background = backgroundTrack(line)?.passthrough;
  if (!line.passthrough && !background) return undefined;
  return { ...(line.passthrough && { line: line.passthrough }), ...(background && { background }) };
}

// A line rebuilt from fields takes back what its source line carried; a background it no longer has takes nothing.
function withLinePassthrough(line: LyricLine, kept: LinePassthrough | undefined): LyricLine {
  if (!kept) return line;
  const background = backgroundTrack(line);
  const withBackground =
    kept.background && background ? withBackgroundTrack(line, { ...background, passthrough: kept.background }) : line;
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
export { linePassthroughOf, withLinePassthrough, withoutKeptData };

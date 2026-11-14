import type { Passthrough } from "insync/passthrough";
import type { LyricLine } from "@/domain/line/model";
import { backgroundTrack } from "@/domain/line/track";
import { withBackgroundTrack } from "@/domain/line/track-writes";

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

// -- Exports ------------------------------------------------------------------

export type { LinePassthrough };
export { linePassthroughOf, withLinePassthrough };

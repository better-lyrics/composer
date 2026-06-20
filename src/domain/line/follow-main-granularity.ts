import { setBackground } from "@/domain/line/background";
import { mainBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { resolveBgGranularity } from "@/domain/line/resolve-bg-granularity";
import { bgVoice, mainVoice } from "@/domain/line/voices";
import { isWordSynced } from "@/domain/voice/predicates";

// -- Granularity follow -------------------------------------------------------

// When a line's MAIN voice transitions INTO word-synced (it was untimed or
// line-synced before, and the write gave it words), re-resolve its existing
// background ONCE so the background follows main into word-synced granularity.
// A background that was already word-synced is returned verbatim (resolver
// reference check); a line-synced background distributes over its own bounds;
// an untimed background distributes over the new main's bounds.
//
// The `isWordSynced(before)` guard makes this fire only on the transition, never
// on a subsequent word edit of an already-word-synced line, so later word edits
// to the background are never clobbered.
function followMainGranularity(before: LyricLine, after: LyricLine): LyricLine {
  if (isWordSynced(mainVoice(before))) return after;
  if (!isWordSynced(mainVoice(after))) return after;
  const bg = bgVoice(after);
  if (bg === null) return after;
  const resolved = resolveBgGranularity(mainVoice(after), bg, { fallbackBounds: mainBounds(after) });
  return resolved === bg ? after : setBackground(after, resolved);
}

// -- Exports ------------------------------------------------------------------

export { followMainGranularity };

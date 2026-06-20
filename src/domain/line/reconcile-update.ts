import { setBackground } from "@/domain/line/background";
import { followMainGranularity } from "@/domain/line/follow-main-granularity";
import { type LooseLine, type LyricLine, reconcileLine, toFlat } from "@/domain/line/model";
import { bgVoice } from "@/domain/line/voices";
import { isLineSynced } from "@/domain/voice/predicates";

// -- Functions ----------------------------------------------------------------

function touchesBackground(updates: Partial<LooseLine>): boolean {
  return "backgroundText" in updates || "backgroundWords" in updates || "backgroundTextSource" in updates;
}

// The reconcile chokepoint for the generic per-line update mutators. Merges the
// flat update onto the line's flat projection and lifts back to nested. A
// line-synced background cannot survive that round-trip (LooseLine has no
// backgroundBegin/end, so toFlat drops its bounds and reconcileLine rebuilds it
// untimed), so when the update leaves the background untouched the prior nested
// background is restored. followMainGranularity then resolves it against the new
// main, distributing a line-synced background over its OWN bounds on the
// main-to-word transition. Every other write is a no-op for the background.
function reconcileUpdate(prev: LyricLine, updates: Partial<LooseLine>): LyricLine {
  const reconciled = reconcileLine({ ...toFlat(prev), ...updates });
  const prevBg = bgVoice(prev);
  const base =
    !touchesBackground(updates) && prevBg !== null && isLineSynced(prevBg)
      ? setBackground(reconciled, prevBg)
      : reconciled;
  return followMainGranularity(prev, base);
}

// -- Exports ------------------------------------------------------------------

export { reconcileUpdate };

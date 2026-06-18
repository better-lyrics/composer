import type { BackgroundVoice, LineSyncedVoice, Voice, WordSyncedVoice } from "@/domain/voice/model";

// -- Functions ----------------------------------------------------------------

function isWordSynced(v: Voice): v is WordSyncedVoice {
  return "words" in v && v.words.length > 0;
}

function isLineSynced(v: Voice): v is LineSyncedVoice {
  return "begin" in v && !isWordSynced(v);
}

function isUntimed(v: Voice): boolean {
  return !isWordSynced(v) && !isLineSynced(v);
}

// Individual WordTiming entries are not deep-validated, matching the flat
// migration path which casts `words as WordTiming[]`.
function isVoice(x: unknown): x is Voice {
  if (typeof x !== "object" || x === null) return false;
  const candidate = x as Record<string, unknown>;
  if (typeof candidate.text !== "string") return false;
  if ("words" in candidate && !Array.isArray(candidate.words)) return false;
  if ("begin" in candidate || "end" in candidate) {
    if (typeof candidate.begin !== "number" || typeof candidate.end !== "number") return false;
  }
  return true;
}

function isBackgroundVoice(x: unknown): x is BackgroundVoice {
  if (!isVoice(x)) return false;
  const candidate = x as Record<string, unknown>;
  if ("source" in candidate && candidate.source !== "extraction" && candidate.source !== "manual") return false;
  return true;
}

// -- Exports ------------------------------------------------------------------

export { isUntimed, isLineSynced, isWordSynced, isVoice, isBackgroundVoice };

import type { WordTiming } from "@/domain/word/timing";
import { stripSplitCharacter } from "@/utils/split-character";
import type { Voice } from "@/domain/voice/model";
import { isLineSynced, isWordSynced } from "@/domain/voice/predicates";

// -- Functions ----------------------------------------------------------------

function effectiveVoiceWords(v: Voice): WordTiming[] {
  if (isWordSynced(v)) return v.words;
  if (isLineSynced(v)) return [{ text: stripSplitCharacter(v.text), begin: v.begin, end: v.end }];
  return [];
}

// -- Exports ------------------------------------------------------------------

export { effectiveVoiceWords };

import type { LyricLine } from "@/domain/line/model";
import { reconcileLine, toFlat } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { isLineSynced } from "@/domain/line/predicates";
import { mainVoice } from "@/domain/line/voices";
import { effectiveVoiceWords } from "@/domain/voice/effective-words";

// -- Functions ----------------------------------------------------------------

function effectiveWords(line: LyricLine): WordTiming[] {
  return effectiveVoiceWords(mainVoice(line));
}

function getEffectiveLines(lines: LyricLine[]): LyricLine[] {
  return lines.map((line) => {
    if (!isLineSynced(line)) return line;
    return reconcileLine({ ...toFlat(line), words: effectiveWords(line) });
  });
}

// -- Exports ------------------------------------------------------------------

export { effectiveWords, getEffectiveLines };

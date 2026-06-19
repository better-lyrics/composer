import { setBackground } from "@/domain/line/background";
import type { LyricLine } from "@/domain/line/model";
import { reconcileLine, toFlat } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import { bgVoice, mainVoice } from "@/domain/line/voices";
import { effectiveVoiceWords } from "@/domain/voice/effective-words";
import { isLineSynced as isLineSyncedVoice } from "@/domain/voice/predicates";
import type { WordTiming } from "@/domain/word/timing";

// -- Functions ----------------------------------------------------------------

function effectiveWords(line: LyricLine): WordTiming[] {
  return effectiveVoiceWords(mainVoice(line));
}

function getEffectiveLines(lines: LyricLine[]): LyricLine[] {
  return lines.map((line) => {
    if (!isLineSynced(line)) return line;
    const converted = reconcileLine({ ...toFlat(line), words: effectiveWords(line) });
    // toFlat cannot express a line-synced background (LooseLine has no
    // backgroundBegin/end), so the round-trip rebuilds it untimed. Restore it.
    const bg = bgVoice(line);
    return bg !== null && isLineSyncedVoice(bg) ? setBackground(converted, bg) : converted;
  });
}

// -- Exports ------------------------------------------------------------------

export { effectiveWords, getEffectiveLines };

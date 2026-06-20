import type { LyricLine } from "@/domain/line/model";
import { reconcileLine, toFlat } from "@/domain/line/model";
import { bgVoice, mainVoice } from "@/domain/line/voices";
import { effectiveVoiceWords } from "@/domain/voice/effective-words";
import { isLineSynced as isLineSyncedVoice } from "@/domain/voice/predicates";

// -- Functions ----------------------------------------------------------------

// Render-only transform: converts each voice's line-synced timing into a single
// effective word so the timeline renders both the main and the background as a
// WordTrack block (symmetric, no bespoke bar). The raw store lines keep their
// true line-synced timing; only the rendered view changes. The two voices
// convert independently, so a word-synced-main + line-synced-bg line still gets
// its background converted.
function getEffectiveLines(lines: LyricLine[]): LyricLine[] {
  return lines.map((line) => {
    const main = mainVoice(line);
    const bg = bgVoice(line);
    const convertMain = isLineSyncedVoice(main);
    const convertBg = bg !== null && isLineSyncedVoice(bg);
    if (!convertMain && !convertBg) return line;
    const flat = { ...toFlat(line) };
    if (convertMain) flat.words = effectiveVoiceWords(main);
    if (convertBg) flat.backgroundWords = effectiveVoiceWords(bg);
    return reconcileLine(flat);
  });
}

// -- Exports ------------------------------------------------------------------

export { getEffectiveLines };

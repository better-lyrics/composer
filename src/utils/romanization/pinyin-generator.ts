import type { LyricLine } from "@/domain/line/model";
import { hasNonLatinScript } from "@/domain/romanization/detect";
import type { GeneratedRomanization, RomanizationGenerator } from "@/domain/romanization/registry";
import { stripSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

type PinyinToneType = "symbol" | "num" | "none";

interface SchemeProfile {
  toneType: PinyinToneType;
}

interface PinyinArrayOptions {
  type: "array";
  multiple: false;
  toneType: PinyinToneType;
}

type PinyinFn = (text: string, options: PinyinArrayOptions) => string[];

// -- Constants ----------------------------------------------------------------

// pinyin-pro ships true Pinyin but does NOT ship Wade-Giles. v1 best-effort:
// strip tone marks and surface lowercase Pinyin syllables, which is closer to
// Wade-Giles' tone-mark-free convention than nothing. A full Wade-Giles syllable
// table is out of scope and slated for a follow-up if anyone asks.
const SCHEME_PROFILES: Record<string, SchemeProfile> = {
  "zh-Latn-pinyin": { toneType: "symbol" },
  "zh-Latn-wadegiles": { toneType: "none" },
};

// -- Singleton ----------------------------------------------------------------

let pinyinFnPromise: Promise<PinyinFn> | null = null;

async function ensurePinyin(): Promise<PinyinFn> {
  if (!pinyinFnPromise) {
    pinyinFnPromise = (async () => {
      const { pinyin } = await import("pinyin-pro");
      return pinyin as PinyinFn;
    })().catch((err) => {
      pinyinFnPromise = null;
      throw err;
    });
  }
  return pinyinFnPromise;
}

// -- Factory ------------------------------------------------------------------

async function createPinyinGenerator(scheme: string): Promise<RomanizationGenerator> {
  const profile = SCHEME_PROFILES[scheme];
  if (!profile) {
    throw new Error(`Unsupported chinese romanization scheme: ${scheme}`);
  }
  const pinyin = await ensurePinyin();

  return {
    scheme,
    async generateLine(line: LyricLine): Promise<GeneratedRomanization> {
      const fullText = stripSplitCharacter(line.text);
      if (!fullText) return { text: fullText };
      if (!hasNonLatinScript(fullText)) return { text: fullText };

      const perCharPinyin = pinyin(fullText, {
        type: "array",
        multiple: false,
        toneType: profile.toneType,
      });

      const sourceChars = Array.from(fullText);
      if (perCharPinyin.length !== sourceChars.length) {
        return { text: perCharPinyin.join(" ") };
      }

      if (!line.words?.length) return { text: perCharPinyin.join(" ") };

      const stripped = line.words.map((w) => stripSplitCharacter(w.text));
      if (stripped.join("") !== fullText) return { text: perCharPinyin.join(" ") };

      const wordTexts: string[] = [];
      let cursor = 0;
      for (const word of stripped) {
        const len = Array.from(word).length;
        const slice = perCharPinyin.slice(cursor, cursor + len);
        wordTexts.push(slice.join(" "));
        cursor += len;
      }

      return { text: wordTexts.join(" "), wordTexts };
    },
  };
}

// -- Exports ------------------------------------------------------------------

export { createPinyinGenerator };

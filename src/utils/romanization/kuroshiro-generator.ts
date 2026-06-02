import type { KuroshiroInstance, RomajiSystem } from "kuroshiro-browser";
import type { LyricLine } from "@/domain/line/model";
import { hasNonLatinScript } from "@/domain/romanization/detect";
import type { GeneratedRomanization, RomanizationGenerator } from "@/domain/romanization/registry";
import { stripSplitCharacter } from "@/utils/split-character";

// -- Constants ----------------------------------------------------------------

const SYSTEM_BY_SCHEME: Record<string, RomajiSystem> = {
  "ja-Latn-hepburn": "hepburn",
  "ja-Latn-kunrei": "nippon",
  "ja-Latn-nihon": "nippon",
};

const KUROSHIRO_USES_PROD_DICT_URLS = true;

const OKURIGANA_START = "(";
const OKURIGANA_END = ")";

// -- Singleton ----------------------------------------------------------------

let kuroshiroPromise: Promise<KuroshiroInstance> | null = null;

async function ensureKuroshiro(): Promise<KuroshiroInstance> {
  if (!kuroshiroPromise) {
    kuroshiroPromise = (async () => {
      const { Kuroshiro } = await import("kuroshiro-browser");
      return Kuroshiro.buildAndInitWithKuromoji(KUROSHIRO_USES_PROD_DICT_URLS);
    })().catch((err) => {
      kuroshiroPromise = null;
      throw err;
    });
  }
  return kuroshiroPromise;
}

// -- Alignment ----------------------------------------------------------------

type CharReading = [sourceChar: string, hiraganaReading: string];

function parseOkuriganaToCharReadings(source: string, okurigana: string): CharReading[] | null {
  const pairs: CharReading[] = [];
  const sourceChars = Array.from(source);
  const annotation = Array.from(okurigana);
  let srcIdx = 0;
  let annoIdx = 0;

  while (srcIdx < sourceChars.length) {
    const srcChar = sourceChars[srcIdx];
    if (annoIdx >= annotation.length) return null;
    const annoChar = annotation[annoIdx];
    if (annoChar !== srcChar) return null;
    annoIdx += 1;
    if (annotation[annoIdx] === OKURIGANA_START) {
      annoIdx += 1;
      let reading = "";
      while (annoIdx < annotation.length && annotation[annoIdx] !== OKURIGANA_END) {
        reading += annotation[annoIdx];
        annoIdx += 1;
      }
      if (annoIdx >= annotation.length) return null;
      annoIdx += 1;
      pairs.push([srcChar, reading]);
    } else {
      pairs.push([srcChar, srcChar]);
    }
    srcIdx += 1;
  }

  if (annoIdx !== annotation.length) return null;
  return pairs;
}

async function alignToWords(
  kuroshiro: KuroshiroInstance,
  fullText: string,
  sourceWords: string[],
  romajiSystem: RomajiSystem,
): Promise<string[] | null> {
  const okurigana = await kuroshiro.convert(fullText, { to: "hiragana", mode: "okurigana" });
  if (typeof okurigana !== "string") return null;

  const pairs = parseOkuriganaToCharReadings(fullText, okurigana);
  if (!pairs) return null;

  const sourceChars = Array.from(fullText);
  if (pairs.length !== sourceChars.length) return null;

  const result: string[] = [];
  let cursor = 0;
  for (const word of sourceWords) {
    const wordChars = Array.from(word);
    const len = wordChars.length;
    if (cursor + len > pairs.length) return null;
    const slice = pairs.slice(cursor, cursor + len);
    for (let i = 0; i < len; i++) {
      if (slice[i][0] !== wordChars[i]) return null;
    }
    const hiragana = slice.map(([, reading]) => reading).join("");
    const romaji = kuroshiro.Util.kanaToRomaji(hiragana, romajiSystem);
    result.push(romaji);
    cursor += len;
  }
  if (cursor !== pairs.length) return null;
  return result;
}

// -- Factory ------------------------------------------------------------------

async function createKuroshiroGenerator(scheme: string): Promise<RomanizationGenerator> {
  const romajiSystem = SYSTEM_BY_SCHEME[scheme];
  if (!romajiSystem) {
    throw new Error(`Unsupported japanese romanization scheme: ${scheme}`);
  }
  const instance = await ensureKuroshiro();

  async function convertLineLevel(text: string): Promise<string> {
    if (!text) return text;
    if (!hasNonLatinScript(text)) return text;
    const raw = await instance.convert(text, { to: "romaji", mode: "spaced", romajiSystem });
    return typeof raw === "string" ? raw : text;
  }

  return {
    scheme,
    async generateLine(line: LyricLine): Promise<GeneratedRomanization> {
      const fullText = stripSplitCharacter(line.text);
      if (!fullText) return { text: fullText };
      if (!hasNonLatinScript(fullText)) return { text: fullText };

      const lineRomaji = await convertLineLevel(fullText);
      if (!line.words?.length) return { text: lineRomaji };

      const strippedWords = line.words.map((w) => stripSplitCharacter(w.text));
      if (strippedWords.join("") !== fullText) return { text: lineRomaji };

      const wordTexts = await alignToWords(instance, fullText, strippedWords, romajiSystem);
      if (!wordTexts) return { text: lineRomaji };

      return { text: wordTexts.join(" "), wordTexts };
    },
  };
}

// -- Exports ------------------------------------------------------------------

export { createKuroshiroGenerator };

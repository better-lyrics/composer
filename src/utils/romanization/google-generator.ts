import type { LyricLine } from "@/domain/line/model";
import { hasNonLatinScript } from "@/domain/romanization/detect";
import type { GeneratedRomanization, RomanizationGenerator } from "@/domain/romanization/registry";
import { GoogleCache } from "@/utils/romanization/google/cache";
import { fetchGoogleRomanization } from "@/utils/romanization/google/fetch";
import { romanizeLinesViaGoogle } from "@/utils/romanization/google/orchestrator";
import { createThrottle } from "@/utils/romanization/google/throttle";
import { stripSplitCharacter } from "@/utils/split-character";

// -- Constants ----------------------------------------------------------------

const SCHEME_TO_LANG: Record<string, string> = {
  "ko-Latn-google": "ko",
  "ru-Latn-google": "ru",
  "el-Latn-google": "el",
  "th-Latn-google": "th",
  "ar-Latn-google": "ar",
  "hi-Latn-google": "hi",
  "bn-Latn-google": "bn",
  "he-Latn-google": "he",
};

const CACHE_MAX_ENTRIES = 10_000;
const THROTTLE_MAX_PER_SECOND = 2;

// -- Factory ------------------------------------------------------------------

async function createGoogleGenerator(scheme: string): Promise<RomanizationGenerator> {
  const sourceLang = SCHEME_TO_LANG[scheme];
  if (!sourceLang) throw new Error(`createGoogleGenerator: unknown scheme ${scheme}`);

  const cache = new GoogleCache({ maxEntries: CACHE_MAX_ENTRIES });
  await cache.open();
  const throttle = createThrottle({ maxPerSecond: THROTTLE_MAX_PER_SECOND });

  async function fetchLineLevel(text: string): Promise<string> {
    const { romaji } = await throttle(() => fetchGoogleRomanization({ sourceLang, text }));
    return romaji;
  }

  return {
    scheme,
    async generateLine(line: LyricLine): Promise<GeneratedRomanization> {
      const fullText = stripSplitCharacter(line.text);
      if (!hasNonLatinScript(fullText)) return { text: fullText };

      if (!line.words?.length) {
        return { text: await fetchLineLevel(fullText) };
      }

      const stripped = line.words.map((w) => stripSplitCharacter(w.text));
      const result = await romanizeLinesViaGoogle({
        sourceLang,
        lines: [stripped],
        cache,
        throttle,
      });
      const row = result[0];
      if (row) return { text: row.join(" "), wordTexts: row };

      return { text: await fetchLineLevel(fullText) };
    },
  };
}

// -- Exports ------------------------------------------------------------------

export { createGoogleGenerator, SCHEME_TO_LANG };
export { RateLimitError } from "@/utils/romanization/google/fetch";

import type { RomajiSystem } from "kuroshiro-browser";
import type { RomanizationGenerator } from "@/domain/romanization/registry";
import type { WordTiming } from "@/domain/word/timing";
import { hasNonLatinScript } from "@/domain/romanization/detect";

// -- Constants ----------------------------------------------------------------

// Kuroshiro ships three Romaji systems: hepburn, nippon, passport. Composer
// surfaces Hepburn, Kunrei-shiki, and Nihon-shiki. Nihon-shiki maps directly to
// nippon. Kunrei-shiki has no native support; nippon is the closest historical
// neighbour (Kunrei is a slightly modernised Nippon-shiki). v1 ships this
// best-effort and documents it in the help section.
const SYSTEM_BY_SCHEME: Record<string, RomajiSystem> = {
  "ja-Latn-hepburn": "hepburn",
  "ja-Latn-kunrei": "nippon",
  "ja-Latn-nihon": "nippon",
};

// -- Singleton ----------------------------------------------------------------

// The kuroshiro-dict Vite plugin serves the dictionary files from /dict/ in
// both dev and prod, so we always tell kuroshiro-browser to use prod-style URLs
// (./dict/*.br) rather than its dev-style ./node_modules/... paths.
const KUROSHIRO_USES_PROD_DICT_URLS = true;

type KuroshiroInstance = import("kuroshiro-browser").KuroshiroInstance;

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

// -- Factory ------------------------------------------------------------------

async function createKuroshiroGenerator(scheme: string): Promise<RomanizationGenerator> {
  const romajiSystem = SYSTEM_BY_SCHEME[scheme];
  if (!romajiSystem) {
    throw new Error(`Unsupported japanese romanization scheme: ${scheme}`);
  }
  const instance = await ensureKuroshiro();

  async function convert(text: string): Promise<string> {
    if (!text) return text;
    if (!hasNonLatinScript(text)) return text;
    const raw = await instance.convert(text, { to: "romaji", mode: "spaced", romajiSystem });
    return typeof raw === "string" ? raw : text;
  }

  return {
    scheme,
    async generateLine(text: string) {
      return convert(text);
    },
    async generateWords(words: WordTiming[]) {
      const out: WordTiming[] = [];
      for (const word of words) {
        const converted = await convert(word.text);
        out.push({ ...word, text: converted.trim() || word.text });
      }
      return out;
    },
  };
}

// -- Exports ------------------------------------------------------------------

export { createKuroshiroGenerator };

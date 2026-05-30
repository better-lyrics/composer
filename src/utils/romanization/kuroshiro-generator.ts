import type { RomajiSystem } from "kuroshiro";
import type Kuroshiro from "kuroshiro";
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

// In production the kuromoji dictionary files are served from `/dict/` (copied
// at build time). Tests inject the real `node_modules` path via
// `setKuroshiroDictPathForTests` so the analyzer reads dicts via fs.
const DEFAULT_DICT_PATH = "/dict/";
let dictPathOverride: string | null = null;
let kuroshiroPromise: Promise<Kuroshiro> | null = null;

function setKuroshiroDictPathForTests(path: string | null): void {
  dictPathOverride = path;
  kuroshiroPromise = null;
}

async function ensureKuroshiro(): Promise<Kuroshiro> {
  if (!kuroshiroPromise) {
    kuroshiroPromise = (async () => {
      const { default: KuroshiroCtor } = await import("kuroshiro");
      const { default: KuromojiAnalyzer } = await import("kuroshiro-analyzer-kuromoji");
      const instance = new KuroshiroCtor();
      const dictPath = dictPathOverride ?? DEFAULT_DICT_PATH;
      await instance.init(new KuromojiAnalyzer({ dictPath }));
      return instance;
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

export { createKuroshiroGenerator, setKuroshiroDictPathForTests };

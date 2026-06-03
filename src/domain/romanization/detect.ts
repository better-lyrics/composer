import type { LyricLine } from "@/domain/line/model";

type DetectedLang = "ja" | "zh" | "ko" | "th" | "ru" | "el" | "ar" | "he" | "hi" | "bn";

interface ScriptMatcher {
  lang: DetectedLang;
  pattern: RegExp;
  priority: number;
}

const SCRIPT_MATCHERS: readonly ScriptMatcher[] = [
  { lang: "ja", pattern: /[\p{Script=Hiragana}\p{Script=Katakana}]/u, priority: 10 },
  { lang: "ko", pattern: /\p{Script=Hangul}/u, priority: 9 },
  { lang: "th", pattern: /\p{Script=Thai}/u, priority: 9 },
  { lang: "ru", pattern: /\p{Script=Cyrillic}/u, priority: 9 },
  { lang: "el", pattern: /\p{Script=Greek}/u, priority: 9 },
  { lang: "ar", pattern: /\p{Script=Arabic}/u, priority: 9 },
  { lang: "he", pattern: /\p{Script=Hebrew}/u, priority: 9 },
  { lang: "hi", pattern: /\p{Script=Devanagari}/u, priority: 9 },
  { lang: "bn", pattern: /\p{Script=Bengali}/u, priority: 9 },
  { lang: "zh", pattern: /\p{Script=Han}/u, priority: 5 },
];

const NON_LATIN_PATTERN = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\s\p{N}\p{P}\p{Z}]/u;
const LATIN_PATTERN = /\p{Script=Latin}/u;

function detectNonLatinLanguage(text: string): DetectedLang | "und" | null {
  if (!text.trim()) return null;
  let best: ScriptMatcher | null = null;
  for (const matcher of SCRIPT_MATCHERS) {
    if (matcher.pattern.test(text) && (best === null || matcher.priority > best.priority)) {
      best = matcher;
    }
  }
  if (best) {
    if (best.lang === "zh" && LATIN_PATTERN.test(text)) return "ja";
    return best.lang;
  }
  if (NON_LATIN_PATTERN.test(text)) return "und";
  return null;
}

function linesEligibleForRomanization(lines: readonly LyricLine[]): LyricLine[] {
  return lines.filter((line) => detectNonLatinLanguage(line.text) !== null);
}

export { detectNonLatinLanguage, linesEligibleForRomanization };
export type { DetectedLang };

import type { Script } from "@/domain/romanization/detect";

// -- Types --------------------------------------------------------------------

interface SchemeEntry {
  id: string;
  label: string;
  script: Script;
}

// -- Registry -----------------------------------------------------------------

const SCHEMES: SchemeEntry[] = [
  { id: "ja-Latn-hepburn", label: "Hepburn", script: "japanese" },
  { id: "ja-Latn-kunrei", label: "Kunrei-shiki", script: "japanese" },
  { id: "ja-Latn-nihon", label: "Nihon-shiki", script: "japanese" },
  { id: "zh-Latn-pinyin", label: "Pinyin", script: "chinese" },
  { id: "zh-Latn-wadegiles", label: "Wade-Giles", script: "chinese" },
  { id: "ko-Latn-google", label: "Romanized (auto)", script: "korean" },
  { id: "ru-Latn-google", label: "Romanized (auto)", script: "russian" },
  { id: "el-Latn-google", label: "Romanized (auto)", script: "greek" },
  { id: "th-Latn-google", label: "Romanized (auto)", script: "thai" },
  { id: "ar-Latn-google", label: "Romanized (auto)", script: "arabic" },
  { id: "hi-Latn-google", label: "Romanized (auto)", script: "hindi" },
  { id: "bn-Latn-google", label: "Romanized (auto)", script: "bengali" },
  { id: "he-Latn-google", label: "Romanized (auto)", script: "hebrew" },
];

const DEFAULT_BY_SCRIPT: Partial<Record<Script, string>> = {
  japanese: "ja-Latn-hepburn",
  chinese: "zh-Latn-pinyin",
  korean: "ko-Latn-google",
  russian: "ru-Latn-google",
  greek: "el-Latn-google",
  thai: "th-Latn-google",
  arabic: "ar-Latn-google",
  hindi: "hi-Latn-google",
  bengali: "bn-Latn-google",
  hebrew: "he-Latn-google",
};

// -- Lookups ------------------------------------------------------------------

function isKnownScheme(id: string): boolean {
  return SCHEMES.some((scheme) => scheme.id === id);
}

function getSchemeByScript(script: Script): string | undefined {
  return DEFAULT_BY_SCRIPT[script];
}

function getSchemeLabel(id: string): string | undefined {
  return SCHEMES.find((scheme) => scheme.id === id)?.label;
}

// -- Exports ------------------------------------------------------------------

export { getSchemeByScript, getSchemeLabel, isKnownScheme, SCHEMES };
export type { SchemeEntry };

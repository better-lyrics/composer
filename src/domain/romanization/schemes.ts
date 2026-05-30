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
];

const DEFAULT_BY_SCRIPT: Partial<Record<Script, string>> = {
  japanese: "ja-Latn-hepburn",
  chinese: "zh-Latn-pinyin",
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

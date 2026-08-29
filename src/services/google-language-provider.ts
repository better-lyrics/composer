import type { TransliterationSegment } from "@/domain/language/model";
import { containsNonLatin, detectNonLatinLanguage } from "@/domain/language/script-detection";
import { normalizeTransliterationForEditing } from "@/domain/language/transliteration-format";
import type {
  LanguageProvider,
  TranslationBatchResult,
  TransliterationBatchResult,
} from "@/services/language-provider";

const API = "https://translate.googleapis.com/translate_a/single";
const translationCache = new Map<string, { text: string | null; detectedLanguage: string }>();
const transliterationCache = new Map<
  string,
  { text: string | null; detectedLanguage: string; segments: TransliterationSegment[] }
>();

function normalizeGoogleTransliteration(value: string): string {
  return normalizeTransliterationForEditing(value);
}

function endpoint(params: Record<string, string>): string {
  const query = new URLSearchParams({ client: "gtx", dt: "t", ...params });
  return `${API}?${query.toString()}`;
}

function romanizationEndpoint(sourceLanguage: string, text: string): string {
  const query = new URLSearchParams({ client: "gtx", sl: sourceLanguage, tl: `${sourceLanguage}-Latn`, q: text });
  query.append("dt", "t");
  query.append("dt", "rm");
  return `${API}?${query.toString()}`;
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown[]> {
  const response = await fetch(url, { cache: "force-cache", signal });
  if (!response.ok) throw new Error(`Google Translate returned ${response.status}`);
  return response.json() as Promise<unknown[]>;
}

function responseParts(data: unknown[]): unknown[][] {
  return Array.isArray(data[0]) ? (data[0] as unknown[][]).filter(Array.isArray) : [];
}

async function translateOne(text: string, targetLanguage: string, signal?: AbortSignal) {
  const key = `${targetLanguage}\u0000${text}`;
  const cached = translationCache.get(key);
  if (cached) return cached;
  const data = await fetchJson(endpoint({ sl: "auto", tl: targetLanguage, q: text }), signal);
  const translated = responseParts(data)
    .map((part) => (typeof part[0] === "string" ? part[0] : ""))
    .join("")
    .trim();
  const result = {
    text: translated && translated.localeCompare(text, undefined, { sensitivity: "accent" }) !== 0 ? translated : null,
    detectedLanguage: typeof data[2] === "string" ? data[2] : "",
  };
  translationCache.set(key, result);
  return result;
}

async function transliterateOne(text: string, sourceLanguage: string, signal?: AbortSignal) {
  const key = `${sourceLanguage}\u0000${text}`;
  const cached = transliterationCache.get(key);
  if (cached) return cached;
  const data = await fetchJson(romanizationEndpoint(sourceLanguage || "auto", text), signal);
  const detectedLanguage = typeof data[2] === "string" ? data[2] : sourceLanguage;
  const parts = responseParts(data);
  const unpairedRomanizationParts: string[] = [];
  const pairedSegments: TransliterationSegment[] = [];
  for (const part of parts) {
    const raw = typeof part[3] === "string" ? part[3] : typeof part[2] === "string" ? part[2] : "";
    const transliteration = normalizeGoogleTransliteration(raw);
    if (typeof part[1] !== "string") {
      if (transliteration) unpairedRomanizationParts.push(transliteration);
      continue;
    }
    if (part[1] && transliteration) pairedSegments.push({ original: part[1], transliteration });
  }
  const unpairedRomanization = normalizeGoogleTransliteration(unpairedRomanizationParts.join(""));
  // Google commonly returns the original and its `dt=rm` romanization as
  // separate entries, with no original-text field on the romanization entry.
  const segments: TransliterationSegment[] = unpairedRomanization
    ? [{ original: text, transliteration: unpairedRomanization }]
    : pairedSegments;
  const joined = normalizeGoogleTransliteration(segments.map((segment) => segment.transliteration).join(" "));
  const result = {
    text: joined && joined.localeCompare(text, undefined, { sensitivity: "accent" }) !== 0 ? joined : null,
    detectedLanguage,
    segments,
  };
  transliterationCache.set(key, result);
  return result;
}

function shouldUseScriptFallback(sourceLanguage: string, inferredLanguage: string): boolean {
  if (sourceLanguage === "auto") return true;
  if (sourceLanguage === inferredLanguage) return false;
  return !["ja", "ko", "zh", "zh-CN", "zh-TW", "ru", "hi", "ar", "th", "el", "he"].includes(sourceLanguage);
}

async function transliterateWithFallback(text: string, sourceLanguage: string, signal?: AbortSignal) {
  const inferredLanguage = containsNonLatin(text) ? detectNonLatinLanguage(text) : null;
  const preferredLanguage =
    inferredLanguage && shouldUseScriptFallback(sourceLanguage, inferredLanguage) ? inferredLanguage : sourceLanguage;
  let result = await transliterateOne(text, preferredLanguage, signal);
  if (!result.text && inferredLanguage && preferredLanguage !== inferredLanguage) {
    result = await transliterateOne(text, inferredLanguage, signal);
  }
  return { ...result, usedLanguage: inferredLanguage ?? result.detectedLanguage ?? preferredLanguage };
}

async function settleWithLimit<T, R>(items: T[], worker: (item: T) => Promise<R>, limit = 6): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await worker(items[index]);
      } catch (error) {
        if ((error as Error).name === "AbortError") throw error;
        console.warn("[Languages] Google request failed", error);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

const googleLanguageProvider: LanguageProvider = {
  id: "google-gtx",
  async translate(lines, targetLanguage, signal): Promise<TranslationBatchResult> {
    const results = await settleWithLimit(lines, (line) => translateOne(line.text, targetLanguage, signal));
    return {
      detectedLanguage: results.find((result) => result?.detectedLanguage)?.detectedLanguage ?? "",
      lines: lines.map((line, index) => ({ id: line.id, text: results[index]?.text ?? null })),
    };
  },
  async transliterate(lines, sourceLanguage, signal): Promise<TransliterationBatchResult> {
    const source = sourceLanguage || "auto";
    const results = await settleWithLimit(lines, (line) => transliterateWithFallback(line.text, source, signal));
    const languageCounts = new Map<string, number>();
    for (const result of results) {
      if (!result?.usedLanguage || result.usedLanguage === "auto") continue;
      languageCounts.set(result.usedLanguage, (languageCounts.get(result.usedLanguage) ?? 0) + 1);
    }
    const detectedLanguage =
      [...languageCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ??
      results.find((result) => result?.detectedLanguage)?.detectedLanguage ??
      source;
    return {
      detectedLanguage,
      language: `${detectedLanguage}-Latn`,
      lines: lines.map((line, index) => ({
        id: line.id,
        text: results[index]?.text ?? null,
        segments: results[index]?.segments ?? [],
      })),
    };
  },
};

export { googleLanguageProvider, normalizeGoogleTransliteration };

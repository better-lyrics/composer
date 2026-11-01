import type { TransliterationSegment } from "@/domain/language/model";

interface LanguageLineInput {
  id: string;
  text: string;
}

interface TranslationLineResult {
  id: string;
  text: string | null;
  /** A request failure, distinct from a successful result with no alternate text. */
  failed?: boolean;
}

interface TransliterationLineResult {
  id: string;
  text: string | null;
  segments: TransliterationSegment[];
  failed?: boolean;
}

interface TranslationBatchResult {
  detectedLanguage: string;
  lines: TranslationLineResult[];
}

interface TransliterationBatchResult {
  detectedLanguage: string;
  language: string;
  lines: TransliterationLineResult[];
}

interface LanguageProvider {
  id: string;
  translate(
    lines: LanguageLineInput[],
    targetLanguage: string,
    sourceLanguage?: string,
    signal?: AbortSignal,
  ): Promise<TranslationBatchResult>;
  transliterate(
    lines: LanguageLineInput[],
    sourceLanguage?: string,
    signal?: AbortSignal,
  ): Promise<TransliterationBatchResult>;
}

export type {
  LanguageLineInput,
  LanguageProvider,
  TranslationBatchResult,
  TranslationLineResult,
  TransliterationBatchResult,
  TransliterationLineResult,
};

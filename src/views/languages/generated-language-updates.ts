import { alignTrackToLine } from "@/domain/language/align";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import {
  lineTranslations,
  lineTransliteration,
  withLanguages,
  withoutTransliteration,
} from "@/domain/language/line-languages";
import type { LineLanguage, LineTranslations, TransliterationSegment } from "@/domain/language/model";
import { withoutPieces } from "@/domain/language/side-pieces";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText, lineText } from "@/domain/line/text";
import type { TranslationLineResult, TransliterationLineResult } from "@/services/language-provider";
import { isStructurallyEqual } from "@/utils/structural-equal";

interface TransliterationGeneration {
  language: string;
  backgroundLanguage?: string;
  main: ReadonlyMap<string, TransliterationLineResult>;
  background: ReadonlyMap<string, TransliterationLineResult>;
}

interface TranslationGeneration {
  language: string;
  main: ReadonlyMap<string, TranslationLineResult>;
  background: ReadonlyMap<string, TranslationLineResult>;
}

interface GeneratedLanguageOptions {
  force: boolean;
  transliteration?: TransliterationGeneration;
  translations: TranslationGeneration[];
}

function withoutAlignment(track: LineLanguage): LineLanguage {
  const bare = withoutPieces(track);
  const { alignmentStatus: _main, ...main } = bare.main;
  if (!bare.bg) return { ...bare, main };
  const { alignmentStatus: _bg, ...bg } = bare.bg;
  return { ...bare, main, bg };
}

function generatedTrack(
  language: string,
  fingerprint: string,
  main: { text?: string | null; segments?: TransliterationSegment[] } | undefined,
  background: { text?: string | null; segments?: TransliterationSegment[] } | undefined,
  withSegments: boolean,
): LineLanguage {
  const backgroundText = background?.text ?? undefined;
  return {
    language,
    main: { text: main?.text ?? "", ...(withSegments && { segments: main?.segments ?? [] }) },
    ...(backgroundText !== undefined && {
      bg: { text: backgroundText, ...(withSegments && background?.segments && { segments: background.segments }) },
    }),
    origin: "google",
    sourceFingerprint: fingerprint,
  };
}

function generatedTransliteration(
  line: LyricLine,
  fingerprint: string,
  { force, transliteration: generatedRoman }: GeneratedLanguageOptions,
): Pick<LyricLine, "languages"> | null {
  const result = generatedRoman?.main.get(line.id);
  const backgroundResult = generatedRoman?.background.get(line.id);
  // Track metadata describes both sides. Commit them together so a failed
  // request cannot erase content or make an older side appear freshly generated.
  if (!generatedRoman || result?.failed || backgroundResult?.failed) return null;
  const current = lineTransliteration(line);
  const mayReplace = force || !current || current.origin === "google";
  let transliteration: LineLanguage | undefined = current;
  if (mayReplace && (result?.text || backgroundResult?.text)) {
    const language = result?.text
      ? generatedRoman.language
      : (generatedRoman.backgroundLanguage ?? generatedRoman.language);
    const generated = generatedTrack(language, fingerprint, result, backgroundResult, true);
    const unchanged = !force && current && isStructurallyEqual(withoutAlignment(current), generated);
    transliteration = unchanged ? current : generated;
  } else if (mayReplace && current?.origin === "google") {
    transliteration = undefined;
  } else if (current && current.sourceFingerprint !== fingerprint) {
    transliteration = { ...current, stale: true };
  } else if (current?.stale) {
    const { stale: _stale, ...fresh } = current;
    transliteration = fresh;
  }
  // Re-aligning an unchanged track would reset its review status; Regenerate still re-aligns.
  if (!force && transliteration === current) return null;
  return transliteration
    ? alignTrackToLine(line, transliteration)
    : withoutTransliteration(line);
}

function generatedTranslations(
  line: LyricLine,
  fingerprint: string,
  { force, translations: generations }: GeneratedLanguageOptions,
): LineTranslations | null {
  if (generations.length === 0) return null;
  const before = lineTranslations(line);
  const translations = { ...(before ?? {}) };
  for (const generated of generations) {
    const result = generated.main.get(line.id);
    const backgroundResult = generated.background.get(line.id);
    if (result?.failed || backgroundResult?.failed) continue;
    const current = translations[generated.language];
    const mayReplace = force || !current || current.origin === "google";
    if (mayReplace && (result?.text || backgroundResult?.text)) {
      translations[generated.language] = generatedTrack(
        generated.language,
        fingerprint,
        result,
        backgroundResult,
        false,
      );
    } else if (mayReplace && current?.origin === "google") {
      // The provider returns null for untranslatable or unchanged text; an
      // old Google translation of different source text is no longer valid.
      delete translations[generated.language];
    } else if (current && current.sourceFingerprint !== fingerprint) {
      if (!current.stale) translations[generated.language] = { ...current, stale: true };
    } else if (current?.stale) {
      const { stale: _stale, ...fresh } = current;
      translations[generated.language] = fresh;
    }
  }
  const changed = generations.some(({ language }) => translations[language] !== before?.[language]);
  return changed ? translations : null;
}

function generatedLanguageUpdates(line: LyricLine, options: GeneratedLanguageOptions): Partial<LyricLine> {
  const fingerprint = languageSourceFingerprint(lineText(line), backgroundText(line));
  const transliteration = generatedTransliteration(line, fingerprint, options);
  const translations = generatedTranslations(line, fingerprint, options);
  if (!transliteration && !translations) return {};
  const base = transliteration ? { ...line, ...transliteration } : line;
  const languages = translations ? withLanguages(base, { translations }).languages : base.languages;
  // Google repeats unchanged results on every visit; an unchanged write would still cost a history step.
  return isStructurallyEqual(languages, line.languages) ? {} : { languages };
}

export { generatedLanguageUpdates };
export type { TranslationGeneration, TransliterationGeneration };

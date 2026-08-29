import { withAlignedTransliteration } from "@/domain/language/align";
import { type BackgroundPlacement, alternateBackgroundPlacement } from "@/domain/language/background-placement";
import {
  hasLexicalBoundaryAfter,
  transliterationSyllables,
  transliterationWordGroups,
} from "@/domain/language/transliteration-format";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { emitWordSpan, escapeXml } from "@/utils/ttml-markup";

function backgroundInsertionIndex(
  placement: BackgroundPlacement,
  chunkCount: number,
  mainWordCount = chunkCount,
): number {
  if (placement.position === "front") return 0;
  if (placement.position === "end") return chunkCount;
  const ratio = (placement.afterWordIndex + 1) / Math.max(1, mainWordCount);
  return Math.max(1, Math.min(chunkCount - 1, Math.round(ratio * chunkCount)));
}

function mergeBackgroundMarkup(mainChunks: string[], backgroundContent: string, insertionIndex: number): string {
  const before = mainChunks.slice(0, insertionIndex).join("").trimEnd();
  const after = mainChunks.slice(insertionIndex).join("").trimStart();
  if (!before) return `<span ttm:role="x-bg">${backgroundContent} </span>${after}`.trimEnd();
  if (!after) return `${before} <span ttm:role="x-bg">${backgroundContent}</span>`;
  return `${before} <span ttm:role="x-bg">${backgroundContent} </span>${after}`;
}

function translationChunks(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.map((word, index) => `${escapeXml(word)}${index < words.length - 1 ? " " : ""}`);
}

function renderTranslationContent(line: LyricLine, text: string, backgroundText?: string): string {
  if (!backgroundText?.trim()) return escapeXml(text);
  const placement = alternateBackgroundPlacement(line);
  const chunks = translationChunks(text);
  const insertionIndex = backgroundInsertionIndex(placement, chunks.length, line.words?.length);
  return mergeBackgroundMarkup(chunks, escapeXml(backgroundText.trim()), insertionIndex);
}

function emitTransliterationSpans(word: WordTiming, text: string): string {
  const tokens = text
    .trim()
    .split(/[-\u2010-\u2015\s]+/)
    .filter(Boolean);
  if (tokens.length <= 1) return emitWordSpan(word, tokens[0] ?? "");
  const totalCharacters = tokens.reduce((sum, token) => sum + token.length, 0);
  const duration = word.end - word.begin;
  let consumedCharacters = 0;
  return tokens
    .map((token, index) => {
      const begin = word.begin + duration * (consumedCharacters / totalCharacters);
      consumedCharacters += token.length;
      const end =
        index === tokens.length - 1 ? word.end : word.begin + duration * (consumedCharacters / totalCharacters);
      return emitWordSpan({ ...word, begin, end }, token);
    })
    .join(" ");
}

function alignedTransliterationChunks(words: WordTiming[]): string[] {
  return words.map((word, index) => {
    const content = emitTransliterationSpans(word, word.transliteration?.trim() || word.text.trimEnd());
    if (index === words.length - 1) return content;
    return `${content}${hasLexicalBoundaryAfter(words, index) ? "  " : " "}`;
  });
}

function emitUntimedTransliteration(text: string): string {
  return transliterationWordGroups(text)
    .map((word) => transliterationSyllables(word).join(" "))
    .join("  ");
}

function transliterationChunks(line: LyricLine, background = false): string[] {
  const words = background ? line.backgroundWords : line.words;
  const text = background ? line.transliteration?.backgroundText : line.transliteration?.text;
  if (words?.some((word) => word.transliteration)) return alignedTransliterationChunks(words);
  return text ? [escapeXml(emitUntimedTransliteration(text))] : [];
}

function renderTransliterationContent(rawLine: LyricLine): string {
  const line = withAlignedTransliteration(rawLine);
  const mainChunks = transliterationChunks(line);
  if (!line.transliteration?.backgroundText?.trim()) return mainChunks.join("");

  const backgroundContent = transliterationChunks(line, true).join("");
  const placement = alternateBackgroundPlacement(line);
  const insertionIndex = backgroundInsertionIndex(placement, mainChunks.length);
  return mergeBackgroundMarkup(mainChunks, backgroundContent, insertionIndex);
}

export { renderTranslationContent, renderTransliterationContent };

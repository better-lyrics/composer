import { alignTrackToLine } from "@/domain/language/align";
import { type BackgroundPlacement, alternateBackgroundPlacement } from "@/domain/language/background-placement";
import { lineTransliteration } from "@/domain/language/line-languages";
import type { LanguagePieces, LineLanguage } from "@/domain/language/model";
import { pieceOf } from "@/domain/language/pieces";
import {
  hasLexicalBoundaryAfter,
  normalizeTransliterationForEditing,
  timedTransliterationSlice,
} from "@/domain/language/transliteration-format";
import type { LyricLine } from "@/domain/line/model";
import { isWordSynced } from "@/domain/line/predicates";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import type { WordTiming } from "@/domain/word/timing";
import { emitWordSpan, escapeXml } from "@/utils/ttml-markup";

function hasAlternateText(track: LineLanguage | undefined): boolean {
  return !!track && (!!track.main.text.trim() || !!track.bg?.text?.trim());
}

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
  if (mainChunks.length === 0) return `<span ttm:role="x-bg">${backgroundContent}</span>`;
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
  const insertionIndex = backgroundInsertionIndex(
    placement,
    chunks.length,
    isWordSynced(line) ? timedSyllables(mainTrack(line)).length : undefined,
  );
  return mergeBackgroundMarkup(chunks, escapeXml(backgroundText.trim()), insertionIndex);
}

function emitTransliterationSpans(word: WordTiming, text: string): string {
  return emitWordSpan(word, text.trim());
}

function alignedTransliterationChunks(words: WordTiming[], pieces: LanguagePieces | undefined): string[] {
  return words.map((word, index) => {
    const piece = pieceOf(pieces, word);
    const text = piece?.text?.trim() || word.text;
    if (index === words.length - 1) return emitTransliterationSpans(word, text);
    const joiner = piece?.joinerAfter ?? (hasLexicalBoundaryAfter(words, index) ? "  " : " ");
    const timed = timedTransliterationSlice({ text, joinerAfter: joiner });
    return `${emitTransliterationSpans(word, timed.text)}${escapeXml(timed.joinerAfter ?? "")}`;
  });
}

function emitUntimedTransliteration(text: string): string {
  return normalizeTransliterationForEditing(text);
}

function transliterationChunks(line: LyricLine, timed: boolean, background = false): string[] {
  const words = timedSyllables(background ? backgroundTrack(line) : mainTrack(line));
  const side = lineTransliteration(line)?.[background ? "bg" : "main"];
  const text = side?.text;
  if (!text?.trim()) return [];
  if (timed && side?.alignmentStatus !== "unresolved" && words.some((word) => pieceOf(side?.pieces, word)?.text)) {
    return alignedTransliterationChunks(words, side?.pieces);
  }
  return text ? [escapeXml(emitUntimedTransliteration(text))] : [];
}

function renderTransliterationContent(rawLine: LyricLine, timed = true): string {
  const track = lineTransliteration(rawLine);
  const line = track ? { ...rawLine, ...alignTrackToLine(rawLine, track) } : rawLine;
  const mainChunks = transliterationChunks(line, timed);
  if (!lineTransliteration(line)?.bg?.text?.trim()) return mainChunks.join("");

  const backgroundContent = transliterationChunks(line, timed, true).join("");
  const placement = alternateBackgroundPlacement(line);
  const insertionIndex = backgroundInsertionIndex(placement, mainChunks.length);
  return mergeBackgroundMarkup(mainChunks, backgroundContent, insertionIndex);
}

export { hasAlternateText, renderTranslationContent, renderTransliterationContent };

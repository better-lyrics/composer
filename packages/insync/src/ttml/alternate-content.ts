import { escapeXmlText } from "../xml-node";
import { alignTrackToLine } from "../language-align";
import { type BackgroundPlacement, alternateBackgroundPlacement } from "../language-background-placement";
import { lineTransliteration } from "../language-line-languages";
import type { LanguagePieces, LineLanguage } from "../language";
import { pieceOf } from "../language-pieces";
import {
  hasLexicalBoundaryAfter,
  normalizeTransliterationForEditing,
  timedTransliterationSlice,
} from "../language-transliteration-format";
import type { LyricLine } from "../line";
import { isWordSynced } from "../line-predicates";
import { backgroundTrack, mainTrack, timedSyllables } from "../line-track";
import type { WordTiming } from "../word-timing";
import { emitWordSpan } from "./markup";

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
  return words.map((word, index) => `${escapeXmlText(word)}${index < words.length - 1 ? " " : ""}`);
}

function renderTranslationContent(line: LyricLine, text: string, backgroundText?: string): string {
  if (!backgroundText?.trim()) return escapeXmlText(text);
  const placement = alternateBackgroundPlacement(line);
  const chunks = translationChunks(text);
  const insertionIndex = backgroundInsertionIndex(
    placement,
    chunks.length,
    isWordSynced(line) ? timedSyllables(mainTrack(line)).length : undefined,
  );
  return mergeBackgroundMarkup(chunks, escapeXmlText(backgroundText.trim()), insertionIndex);
}

function emitTransliterationSpans(word: WordTiming, text: string): string {
  return emitWordSpan(word, text.trim());
}

interface TransliterationChunk {
  readonly out: string;
  readonly wordIndex?: number;
}

// A syllable with no reading writes nothing; the joiner into the next reading is the one before its syllable.
function alignedTransliterationChunks(words: WordTiming[], pieces: LanguagePieces | undefined): TransliterationChunk[] {
  const read = words.flatMap((word, index) => {
    const text = pieceOf(pieces, word)?.text?.trim();
    return text ? [{ word, index, text }] : [];
  });
  return read.map(({ word, index, text }, at) => {
    if (at === read.length - 1) return { out: emitTransliterationSpans(word, text), wordIndex: index };
    const before = read[at + 1].index - 1;
    const joiner = pieceOf(pieces, words[before])?.joinerAfter ?? (hasLexicalBoundaryAfter(words, before) ? "  " : " ");
    const timed = timedTransliterationSlice({ text, joinerAfter: joiner });
    return {
      out: `${emitTransliterationSpans(word, timed.text)}${escapeXmlText(timed.joinerAfter ?? "")}`,
      wordIndex: index,
    };
  });
}

function emitUntimedTransliteration(text: string): string {
  return normalizeTransliterationForEditing(text);
}

function transliterationChunks(line: LyricLine, timed: boolean, background = false): TransliterationChunk[] {
  const words = timedSyllables(background ? backgroundTrack(line) : mainTrack(line));
  const side = lineTransliteration(line)?.[background ? "bg" : "main"];
  const text = side?.text;
  if (!text?.trim()) return [];
  if (timed && side?.alignmentStatus !== "unresolved" && words.some((word) => pieceOf(side?.pieces, word)?.text)) {
    return alignedTransliterationChunks(words, side?.pieces);
  }
  return text ? [{ out: escapeXmlText(emitUntimedTransliteration(text)) }] : [];
}

function renderTransliterationContent(rawLine: LyricLine, splitChar: string, timed = true): string {
  const track = lineTransliteration(rawLine);
  const line = track ? { ...rawLine, ...alignTrackToLine(rawLine, track, splitChar) } : rawLine;
  const chunks = transliterationChunks(line, timed);
  const mainChunks = chunks.map((chunk) => chunk.out);
  if (!lineTransliteration(line)?.bg?.text?.trim()) return mainChunks.join("");

  const backgroundContent = transliterationChunks(line, timed, true)
    .map((chunk) => chunk.out)
    .join("");
  const placement = alternateBackgroundPlacement(line);
  const readIndexes = chunks.flatMap((chunk) => (chunk.wordIndex === undefined ? [] : [chunk.wordIndex]));
  const insertionIndex =
    placement.position === "middle" && readIndexes.length === chunks.length
      ? readIndexes.filter((index) => index <= placement.afterWordIndex).length
      : backgroundInsertionIndex(placement, mainChunks.length);
  return mergeBackgroundMarkup(mainChunks, backgroundContent, insertionIndex);
}

export { hasAlternateText, renderTranslationContent, renderTransliterationContent };

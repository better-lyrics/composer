import { reconcileLine, type LooseLine } from "@/domain/line/model";
import { hasAnyTiming } from "@/domain/line/predicates";
import type { WordTiming } from "@/domain/word/timing";
import { generateLineId, type ParseResult } from "@/utils/lyrics-parsers/shared";

// -- Constants ----------------------------------------------------------------

const LINE_HEADER_REGEX = /\[(\d+),(\d+)\]/g;
const WORD_TAG_REGEX = /(.*?)\((\d+),(\d+)\)/gs;
const MS_PER_SECOND = 1000;

// -- Types --------------------------------------------------------------------

interface QrcLine {
  begin: number;
  end: number;
  words: WordTiming[];
  text: string;
}

// -- Helpers ------------------------------------------------------------------

function extractLyricContent(content: string): string {
  if (!content.includes("<QrcInfos")) return content;

  const doc = new DOMParser().parseFromString(content, "text/xml");
  if (doc.querySelector("parsererror")) {
    console.warn("[Composer] QRC document is not well-formed XML, reading it as a raw body");
    return content;
  }

  return doc.querySelector("[LyricContent]")?.getAttribute("LyricContent") ?? "";
}

// Sum in milliseconds before dividing: 35.42 + 0.938 is 36.358000000000004.
function toSeconds(beginMs: string, durationMs: string): { begin: number; end: number } {
  const begin = Number.parseInt(beginMs, 10);
  const duration = Number.parseInt(durationMs, 10);
  return { begin: begin / MS_PER_SECOND, end: (begin + duration) / MS_PER_SECOND };
}

function parseWords(body: string): WordTiming[] {
  const words: WordTiming[] = [];
  const regex = new RegExp(WORD_TAG_REGEX.source, WORD_TAG_REGEX.flags);
  let match: RegExpExecArray | null = regex.exec(body);
  while (match !== null) {
    const { begin, end } = toSeconds(match[2], match[3]);
    words.push({ text: match[1], begin, end });
    match = regex.exec(body);
  }
  return words;
}

function tokenizeLines(lyricContent: string): QrcLine[] {
  const headers = [...lyricContent.matchAll(LINE_HEADER_REGEX)];
  return headers.map((header, index) => {
    const bodyStart = (header.index ?? 0) + header[0].length;
    const bodyEnd = headers[index + 1]?.index ?? lyricContent.length;
    const body = lyricContent.slice(bodyStart, bodyEnd);
    const { begin, end } = toSeconds(header[1], header[2]);
    const words = parseWords(body);
    const text = words.length > 0 ? words.map((word) => word.text).join("") : body;
    return { begin, end, words, text: text.trim() };
  });
}

// -- QRC Parser ---------------------------------------------------------------

function parseQrc(content: string): ParseResult {
  const parsed = tokenizeLines(extractLyricContent(content));

  const lines: LooseLine[] = parsed
    .filter((line) => line.text.length > 0)
    .map((line) => ({
      id: generateLineId(),
      text: line.text,
      agentId: "v1",
      ...(line.words.length > 0 ? { words: line.words } : { begin: line.begin, end: line.end }),
    }));

  const reconciledLines = lines.map(reconcileLine);
  return {
    lines: reconciledLines,
    metadata: {},
    hasTimingData: reconciledLines.some(hasAnyTiming),
  };
}

// -- Exports ------------------------------------------------------------------

export { parseQrc };

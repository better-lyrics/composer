import { reconcileLine, type LooseLine } from "@/domain/line/model";
import { hasAnyTiming } from "@/domain/line/predicates";
import { reconstructLineText } from "@/domain/line/reconstruct-text";
import type { ProjectMetadata } from "@/domain/project/metadata";
import type { WordTiming } from "@/domain/word/timing";
import {
  creditExtraKey,
  creditValue,
  decodeCredits,
  isCreditLine,
  isQrcTitleLine,
  parseHeaderTags,
} from "@/utils/lyrics-parsers/qrc-metadata";
import { generateLineId, type ParseResult } from "@/utils/lyrics-parsers/shared";
import { getSplitCharacter } from "@/utils/split-character";

// -- Constants ----------------------------------------------------------------

const LINE_HEADER_REGEX = /\[(\d+),(\d+)\]/g;
const WORD_TAG_REGEX = /\((\d+),(\d+)\)/g;
const MS_PER_SECOND = 1000;
const DEFAULT_AGENT_ID = "v1";

// -- Types --------------------------------------------------------------------

interface QrcLine {
  begin: number;
  end: number;
  words: WordTiming[];
  text: string;
}

interface QrcBody {
  words: WordTiming[];
  residue: string;
}

interface QrcSemantics {
  lines: LooseLine[];
  metadata: Partial<ProjectMetadata>;
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

// A word tag trails the word it times, so each word is the slice between the
// previous tag and this one. Whatever follows the last tag is the residue.
function parseWords(body: string): QrcBody {
  const words: WordTiming[] = [];
  let cursor = 0;
  for (const match of body.matchAll(WORD_TAG_REGEX)) {
    const { begin, end } = toSeconds(match[1], match[2]);
    words.push({ text: body.slice(cursor, match.index), begin, end });
    cursor = match.index + match[0].length;
  }
  return { words, residue: body.slice(cursor) };
}

function tokenizeLines(lyricContent: string): QrcLine[] {
  const headers = [...lyricContent.matchAll(LINE_HEADER_REGEX)];
  const splitChar = getSplitCharacter();
  return headers.map((header, index) => {
    const bodyEnd = headers[index + 1]?.index ?? lyricContent.length;
    const body = lyricContent.slice(header.index + header[0].length, bodyEnd);
    const { begin, end } = toSeconds(header[1], header[2]);
    const { words, residue } = parseWords(body);
    // Text trailing the last tag has no timing of its own, so the line drops to
    // line timing rather than dropping that text.
    if (words.length === 0 || residue.trim().length > 0) {
      return { begin, end, words: [], text: body.replace(WORD_TAG_REGEX, "").trim() };
    }
    return { begin, end, words, text: reconstructLineText(words, splitChar) };
  });
}

function shiftQrcLine(line: QrcLine, offsetSeconds: number): QrcLine {
  const shift = (seconds: number) => Math.max(0, seconds + offsetSeconds);
  return {
    begin: shift(line.begin),
    end: shift(line.end),
    text: line.text,
    words: line.words.map((word) => ({ ...word, begin: shift(word.begin), end: shift(word.end) })),
  };
}

// -- QRC semantics ------------------------------------------------------------

// Peels the non-lyric content QQ mixes into the lyrics off in one walk: the
// title line and the credits block.
function readQrcSemantics(parsed: QrcLine[], headerMetadata: Partial<ProjectMetadata>): QrcSemantics {
  const lines: LooseLine[] = [];
  const songwriters = new Set<string>();
  const extra: Record<string, string> = { ...headerMetadata.extra };

  for (const line of parsed) {
    if (line.text.length === 0) continue;

    if (isCreditLine(line.text)) {
      const value = creditValue(line.text);
      extra[creditExtraKey(line.text)] = value;
      for (const name of decodeCredits(value)) songwriters.add(name);
      continue;
    }
    if (isQrcTitleLine(line.text, headerMetadata)) continue;

    lines.push({
      id: generateLineId(),
      text: line.text,
      agentId: DEFAULT_AGENT_ID,
      ...(line.words.length > 0 ? { words: line.words } : { begin: line.begin, end: line.end }),
    });
  }

  const metadata: Partial<ProjectMetadata> = { ...headerMetadata };
  if (songwriters.size > 0) metadata.songwriters = [...songwriters];
  if (Object.keys(extra).length > 0) metadata.extra = extra;
  return { lines, metadata };
}

// -- QRC Parser ---------------------------------------------------------------

function parseQrc(content: string): ParseResult {
  const lyricContent = extractLyricContent(content);
  const header = parseHeaderTags(lyricContent);
  const tokenized = tokenizeLines(lyricContent);
  const parsed =
    header.offsetSeconds === 0 ? tokenized : tokenized.map((line) => shiftQrcLine(line, header.offsetSeconds));
  const { lines, metadata } = readQrcSemantics(parsed, header.metadata);

  const reconciledLines = lines.map(reconcileLine);
  return {
    lines: reconciledLines,
    metadata,
    hasTimingData: reconciledLines.some(hasAnyTiming),
  };
}

// -- Exports ------------------------------------------------------------------

export { MS_PER_SECOND, parseQrc };

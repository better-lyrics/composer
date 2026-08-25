import type { Agent } from "@/domain/agent/model";
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
  MS_PER_SECOND,
  parseHeaderTags,
  readSingerMarker,
} from "@/utils/lyrics-parsers/qrc-metadata";
import { generateLineId, type ParseResult } from "@/utils/lyrics-parsers/shared";
import { getSplitCharacter, stripSplitCharacter } from "@/utils/split-character";

// -- Constants ----------------------------------------------------------------

const LINE_HEADER_REGEX = /\[(\d+),(\d+)\]/g;
const WORD_TAG_REGEX = /\((\d+),(\d+)\)/g;
const DEFAULT_AGENT_NAME = "Voice 1";
const DEFAULT_AGENT: Agent = { id: "v1", type: "person", name: DEFAULT_AGENT_NAME };

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
  agents?: Agent[];
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

function agentForSinger(name: string, agents: Agent[], byName: Map<string, Agent>): Agent {
  const existing = byName.get(name);
  if (existing) return existing;

  const agent: Agent = { id: `v${agents.length + 1}`, type: "person", name };
  agents.push(agent);
  byName.set(name, agent);
  return agent;
}

// Peels the non-lyric content QQ mixes into the lyrics off in one walk: the
// title line, the credits block and the singer markers.
function readQrcSemantics(parsed: QrcLine[], headerMetadata: Partial<ProjectMetadata>): QrcSemantics {
  const lines: LooseLine[] = [];
  const songwriters = new Set<string>();
  const extra: Record<string, string> = { ...headerMetadata.extra };
  const agents: Agent[] = [];
  const agentsByName = new Map<string, Agent>();
  let currentAgentId = DEFAULT_AGENT.id;

  for (const line of parsed) {
    if (line.text.length === 0) continue;
    // Classification and the names it extracts read the separator-free text; the
    // stored line keeps the reconstruction, split characters and all.
    const plainText = stripSplitCharacter(line.text);

    if (isCreditLine(plainText)) {
      const value = creditValue(plainText);
      if (value.length > 0) {
        extra[creditExtraKey(plainText)] = value;
        for (const name of decodeCredits(value)) songwriters.add(name);
      }
      continue;
    }
    if (isQrcTitleLine(plainText, headerMetadata)) continue;

    const singer = readSingerMarker(plainText);
    if (singer !== null) {
      // Lines already emitted predate every marker, so they belong to an unnamed
      // voice rather than to the first singer the document happens to announce.
      if (agents.length === 0 && lines.length > 0) {
        agents.push(DEFAULT_AGENT);
        agentsByName.set(DEFAULT_AGENT_NAME, DEFAULT_AGENT);
      }
      currentAgentId = agentForSinger(singer, agents, agentsByName).id;
      continue;
    }

    lines.push({
      id: generateLineId(),
      text: line.text,
      agentId: currentAgentId,
      ...(line.words.length > 0 ? { words: line.words } : { begin: line.begin, end: line.end }),
    });
  }

  const metadata: Partial<ProjectMetadata> = { ...headerMetadata };
  if (songwriters.size > 0) metadata.songwriters = [...songwriters];
  if (Object.keys(extra).length > 0) metadata.extra = extra;
  return { lines, metadata, agents: agents.length > 0 ? agents : undefined };
}

// -- QRC Parser ---------------------------------------------------------------

function parseQrc(content: string): ParseResult {
  const lyricContent = extractLyricContent(content);
  const header = parseHeaderTags(lyricContent);
  const tokenized = tokenizeLines(lyricContent);
  const parsed =
    header.offsetSeconds === 0 ? tokenized : tokenized.map((line) => shiftQrcLine(line, header.offsetSeconds));
  const { lines, metadata, agents } = readQrcSemantics(parsed, header.metadata);

  const reconciledLines = lines.map(reconcileLine);
  return {
    lines: reconciledLines,
    metadata,
    hasTimingData: reconciledLines.some(hasAnyTiming),
    agents,
  };
}

// -- Exports ------------------------------------------------------------------

export { parseQrc };

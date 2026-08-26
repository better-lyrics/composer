import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import type { Agent } from "@/domain/agent/model";
import { reconcileLine, type LooseLine } from "@/domain/line/model";
import { hasAnyTiming } from "@/domain/line/predicates";
import { reconstructLineText } from "@/domain/line/reconstruct-text";
import { matchAllLineHeaders, matchAllWordTags, stripWordTags } from "@/domain/lyrics-file/qrc-syntax";
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
import { getSplitCharacter } from "@/utils/split-character";

// -- Constants ----------------------------------------------------------------

const DEFAULT_AGENT_NAME = DEFAULT_AGENTS[0].name;

// -- Types --------------------------------------------------------------------

// `text` is what the line displays, split characters and all. `plainText` is the
// same line as QQ wrote it, which is what every classifier reads.
interface QrcLine {
  begin: number;
  end: number;
  words: WordTiming[];
  text: string;
  plainText: string;
}

interface QrcLineBody {
  words: WordTiming[];
  residue: string;
}

interface QrcPartition {
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
function parseWords(body: string): QrcLineBody {
  const words: WordTiming[] = [];
  let cursor = 0;
  for (const match of matchAllWordTags(body)) {
    const { begin, end } = toSeconds(match[1], match[2]);
    words.push({ text: body.slice(cursor, match.index), begin, end });
    cursor = match.index + match[0].length;
  }
  return { words, residue: body.slice(cursor) };
}

function tokenizeLines(lyricContent: string): QrcLine[] {
  const headers = matchAllLineHeaders(lyricContent);
  const splitChar = getSplitCharacter();
  return headers.map((header, index) => {
    const bodyEnd = headers[index + 1]?.index ?? lyricContent.length;
    const body = lyricContent.slice(header.index + header[0].length, bodyEnd);
    const { begin, end } = toSeconds(header[1], header[2]);
    const { words, residue } = parseWords(body);
    // Text trailing the last tag has no timing of its own, so the line drops to
    // line timing rather than dropping that text.
    if (words.length === 0 || residue.trim().length > 0) {
      const text = stripWordTags(body).trim();
      return { begin, end, words: [], text, plainText: text };
    }
    return {
      begin,
      end,
      words,
      text: reconstructLineText(words, splitChar),
      plainText: words.map((word) => word.text).join(""),
    };
  });
}

function shiftQrcLine(line: QrcLine, offsetSeconds: number): QrcLine {
  const shift = (seconds: number) => Math.max(0, seconds + offsetSeconds);
  return {
    ...line,
    begin: shift(line.begin),
    end: shift(line.end),
    words: line.words.map((word) => ({ ...word, begin: shift(word.begin), end: shift(word.end) })),
  };
}

// -- QRC semantics ------------------------------------------------------------

function agentIdAt(index: number): string {
  return `v${index + 1}`;
}

// Markers are hand-authored, so casing drifts within one document. The key is
// folded; the display name stays as the document first wrote it.
function ensureAgent(name: string, agents: Agent[], byName: Map<string, Agent>): Agent {
  const key = name.toLowerCase();
  const existing = byName.get(key);
  if (existing) return existing;

  const agent: Agent = { id: agentIdAt(agents.length), type: "person", name };
  agents.push(agent);
  byName.set(key, agent);
  return agent;
}

// Peels the non-lyric content QQ mixes into the lyrics off in one walk: the
// title line, the credits block and the singer markers.
function partitionQrcLines(parsed: QrcLine[], headerMetadata: Partial<ProjectMetadata>): QrcPartition {
  const lines: LooseLine[] = [];
  const songwriters = new Set<string>();
  const extra: Record<string, string> = { ...headerMetadata.extra };
  const agents: Agent[] = [];
  const agentsByName = new Map<string, Agent>();
  let currentAgentId = agentIdAt(0);

  for (const line of parsed) {
    if (line.text.length === 0) continue;

    if (isCreditLine(line.plainText)) {
      const value = creditValue(line.plainText);
      if (value.length > 0) {
        const key = creditExtraKey(line.plainText);
        // QQ wraps a long credit list across two lines under the same prefix.
        extra[key] = extra[key] ? `${extra[key]}/${value}` : value;
        for (const name of decodeCredits(value)) songwriters.add(name);
      }
      continue;
    }
    if (isQrcTitleLine(line.plainText, headerMetadata)) continue;

    const singer = readSingerMarker(line.plainText);
    if (singer !== null) {
      // Lines already emitted predate every marker, so they belong to an unnamed
      // voice rather than to the first singer the document happens to announce.
      if (agents.length === 0 && lines.length > 0 && DEFAULT_AGENT_NAME) {
        ensureAgent(DEFAULT_AGENT_NAME, agents, agentsByName);
      }
      currentAgentId = ensureAgent(singer, agents, agentsByName).id;
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
  const { lines, metadata, agents } = partitionQrcLines(parsed, header.metadata);

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

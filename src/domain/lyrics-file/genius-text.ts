import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import type { Agent } from "@/domain/agent/model";
import { createPerformerAgents, dedupeIgnoringCase } from "@/domain/agent/performer-agents";

// -- Types --------------------------------------------------------------------

interface GeniusLine {
  text: string;
  agentId: string;
}

interface GeniusLyrics {
  lines: GeniusLine[];
  agents?: Agent[];
}

// -- Constants ----------------------------------------------------------------

const SECTION_TAG =
  /^\[(?:intro|verse|pre-chorus|chorus|post-chorus|hook|pre-hook|refrain|bridge|breakdown|interlude|outro|instrumental|part|skit|drop)\b[^\]:]*(?::([^\]]*))?\]$/i;
const PAGE_HEADER = /^\d[\d,.]*K?\s+Contributors?$/i;
const INLINE_PROMO = /^(?:You might also like|See .+ Live|Get tickets as low as \$\d+)$/i;
const EMBED_COUNTER = /\d*Embed$/;
const CREDIT_SEPARATOR = /\s+&\s+/;
const PAGE_TITLE = /\sLyrics$/;
const EMPHASIS_MARKS = /^[*_()\s]+|[*_()\s]+$/g;
const MIN_SECTION_TAGS = 2;
const LEAD_AGENT_ID = "v1";
const LEAD_NAME = DEFAULT_AGENTS[0].name ?? "Lead";

// -- Helpers ------------------------------------------------------------------

function trimmedRows(text: string): string[] {
  return text.split(/\r?\n/).map((row) => row.trim());
}

function isSectionTagLine(line: string): boolean {
  return SECTION_TAG.test(line.trim());
}

function hasPageHeader(rows: readonly string[]): boolean {
  return rows.some((row) => PAGE_HEADER.test(row));
}

function readsAsGeniusPageCopy(text: string): boolean {
  return hasPageHeader(trimmedRows(text));
}

function readsAsGeniusLyrics(text: string): boolean {
  const rows = trimmedRows(text);
  return hasPageHeader(rows) || rows.filter((row) => SECTION_TAG.test(row)).length >= MIN_SECTION_TAGS;
}

function creditedPerformers(credit: string): string[] {
  const names = credit
    .split(CREDIT_SEPARATOR)
    .map((name) => name.replace(EMPHASIS_MARKS, ""))
    .filter((name) => name !== "");
  return dedupeIgnoringCase(names);
}

// The page header (contributors, translations, "<Title> Lyrics") sits above the first section tag.
function lyricsStart(rows: readonly string[]): number {
  const header = rows.findIndex((row) => PAGE_HEADER.test(row));
  if (header === -1) return 0;
  const firstTag = rows.findIndex((row) => SECTION_TAG.test(row));
  if (firstTag > header) return firstTag;
  const title = rows.findIndex((row, index) => index > header && PAGE_TITLE.test(row));
  return title === -1 ? header + 1 : title + 1;
}

function withoutBlankEdges(lines: GeniusLine[]): GeniusLine[] {
  const first = lines.findIndex((line) => line.text !== "");
  const last = lines.findLastIndex((line) => line.text !== "");
  return first === -1 ? [] : lines.slice(first, last + 1);
}

// -- Reading ------------------------------------------------------------------

function readGeniusLyrics(text: string): GeniusLyrics {
  const rows = trimmedRows(text);
  const body = rows.slice(lyricsStart(rows));
  const lastLyric = body.findLastIndex((row) => row !== "" && !SECTION_TAG.test(row));
  const lines: GeniusLine[] = [];
  const performers = createPerformerAgents();
  let agentId = LEAD_AGENT_ID;
  body.forEach((row, index) => {
    const tag = SECTION_TAG.exec(row);
    if (tag) {
      const names = creditedPerformers(tag[1] ?? "");
      // Genius leaves the credit off sections the primary artist sings, so uncredited lines are the lead's.
      if (names.length > 0 && performers.agents.length === 0 && lines.some((line) => line.text !== "")) {
        performers.agentFor([LEAD_NAME]);
      }
      agentId = names.length > 0 ? performers.agentFor(names).id : (performers.agents[0]?.id ?? LEAD_AGENT_ID);
      return;
    }
    if (INLINE_PROMO.test(row)) return;
    const lyric = index === lastLyric ? row.replace(EMBED_COUNTER, "").trimEnd() : row;
    if (lyric === "" && row !== "") return;
    lines.push({ text: lyric, agentId });
  });
  return {
    lines: withoutBlankEdges(lines),
    agents: performers.agents.length > 0 ? performers.agents : undefined,
  };
}

// -- Exports ------------------------------------------------------------------

export { isSectionTagLine, readGeniusLyrics, readsAsGeniusLyrics, readsAsGeniusPageCopy };

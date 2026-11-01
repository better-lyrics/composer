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
const ARTIST_LIST_JOINER = /\s+&\s+/;
const ARTIST_LIST_SEPARATOR = /\s*,\s*|\s+&\s+/;
const PAGE_TITLE = /\sLyrics$/;
const SONG_DESCRIPTION = /Read More$/;
const WRAPPING_MARKS = /^(?:\*+([^*]+)\*+|_+([^_]+)_+|\(([^()]+)\))$/;
const MIN_SECTION_TAGS = 2;
const MAX_HEADER_ROWS = 30;
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

// Genius wraps a credited name in emphasis ("*Drake*", "**Drake**", "(Rihanna)"); marks inside a name stay.
function unwrappedName(name: string): string {
  let text = name.trim();
  for (let wrapped = WRAPPING_MARKS.exec(text); wrapped; wrapped = WRAPPING_MARKS.exec(text)) {
    text = (wrapped[1] ?? wrapped[2] ?? wrapped[3]).trim();
  }
  return text;
}

// A lone comma belongs to a name ("Tyler, The Creator"); with an ampersand it separates a list ("A, B & C").
function creditedPerformers(credit: string): string[] {
  const list = unwrappedName(credit);
  const names = (ARTIST_LIST_JOINER.test(list) ? list.split(ARTIST_LIST_SEPARATOR) : [list])
    .map(unwrappedName)
    .filter((name) => name !== "");
  return dedupeIgnoringCase(names);
}

// The page header (contributors, translations, "<Title> Lyrics", a "Read More" description) sits above the lyrics.
function lyricsStart(rows: readonly string[]): number {
  const header = rows.findIndex((row) => PAGE_HEADER.test(row));
  if (header === -1) return 0;
  const firstTag = rows.findIndex((row) => SECTION_TAG.test(row));
  const headerEnd = Math.min(header + MAX_HEADER_ROWS, firstTag > header ? firstTag : rows.length);
  const title = rows.findIndex((row, index) => index > header && index < headerEnd && PAGE_TITLE.test(row));
  if (title !== -1) {
    const description = rows.findIndex(
      (row, index) => index > title && index < headerEnd && SONG_DESCRIPTION.test(row),
    );
    return (description === -1 ? title : description) + 1;
  }
  return firstTag > header ? firstTag : header + 1;
}

// Genius leaves the credit off sections the primary artist sings without naming them, so a
// placeholder lead takes those lines whenever other sections name their singers.
function needsLead(body: readonly string[]): boolean {
  let anyCredit = false;
  let sectionCredited = false;
  let uncreditedLyric = false;
  for (const row of body) {
    const tag = SECTION_TAG.exec(row);
    if (tag) {
      sectionCredited = creditedPerformers(tag[1] ?? "").length > 0;
      anyCredit ||= sectionCredited;
    } else if (!sectionCredited && !INLINE_PROMO.test(row) && row.replace(EMBED_COUNTER, "") !== "") {
      uncreditedLyric = true;
    }
  }
  return anyCredit && uncreditedLyric;
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
  if (needsLead(body)) performers.agentFor([LEAD_NAME]);
  let agentId = LEAD_AGENT_ID;
  body.forEach((row, index) => {
    const tag = SECTION_TAG.exec(row);
    if (tag) {
      const names = creditedPerformers(tag[1] ?? "");
      agentId = names.length > 0 ? performers.agentFor(names).id : LEAD_AGENT_ID;
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

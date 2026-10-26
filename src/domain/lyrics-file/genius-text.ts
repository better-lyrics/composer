// -- Types --------------------------------------------------------------------

interface GeniusLine {
  text: string;
  agentId: string;
}

interface GeniusLyrics {
  lines: GeniusLine[];
}

// -- Constants ----------------------------------------------------------------

const SECTION_TAG =
  /^\[(?:intro|verse|pre-chorus|chorus|post-chorus|hook|pre-hook|refrain|bridge|breakdown|interlude|outro|instrumental|part|skit|drop)\b[^\]:]*(?::([^\]]*))?\]$/i;
const PAGE_HEADER = /^\d[\d,.]*K?\s+Contributors?$/i;
const INLINE_PROMO = /^(?:You might also like|See .+ Live|Get tickets as low as \$\d+)$/i;
const EMBED_COUNTER = /\d*Embed$/;
const MIN_SECTION_TAGS = 2;
const LEAD_AGENT_ID = "v1";

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

function readsAsGeniusLyrics(text: string): boolean {
  const rows = trimmedRows(text);
  return hasPageHeader(rows) || rows.filter((row) => SECTION_TAG.test(row)).length >= MIN_SECTION_TAGS;
}

function withoutBlankEdges(lines: GeniusLine[]): GeniusLine[] {
  const first = lines.findIndex((line) => line.text !== "");
  const last = lines.findLastIndex((line) => line.text !== "");
  return first === -1 ? [] : lines.slice(first, last + 1);
}

// -- Reading ------------------------------------------------------------------

function readGeniusLyrics(text: string): GeniusLyrics {
  const rows = trimmedRows(text);
  const firstTag = rows.findIndex((row) => SECTION_TAG.test(row));
  const body = hasPageHeader(rows) && firstTag > 0 ? rows.slice(firstTag) : rows;
  const lastLyric = body.findLastIndex((row) => row !== "" && !SECTION_TAG.test(row));
  const lines: GeniusLine[] = [];
  const agentId = LEAD_AGENT_ID;
  body.forEach((row, index) => {
    if (SECTION_TAG.test(row) || INLINE_PROMO.test(row)) return;
    const lyric = index === lastLyric ? row.replace(EMBED_COUNTER, "").trimEnd() : row;
    if (lyric === "" && row !== "") return;
    lines.push({ text: lyric, agentId });
  });
  return { lines: withoutBlankEdges(lines) };
}

// -- Exports ------------------------------------------------------------------

export { isSectionTagLine, readGeniusLyrics, readsAsGeniusLyrics };
export type { GeniusLyrics };

import type { LyricLine } from "@/domain/line/model";
import type { LyricsSearchPayload, LyricsSearchResult } from "@/domain/lyrics-search/result";
import type { ParseResult } from "@/utils/lyrics-parsers/shared";

// -- Constants ----------------------------------------------------------------

const PAYLOAD_EXTENSIONS: Record<LyricsSearchPayload["kind"], string> = {
  lrc: "lrc",
  ttml: "ttml",
  qrc: "qrc",
  "deferred-ttml": "ttml",
};

function wrapTextAsParseResult(lines: LyricLine[]): ParseResult {
  return { lines, metadata: {}, hasTimingData: false };
}

function syntheticFilenameForResult(result: LyricsSearchResult): string {
  return `${result.source}-${result.id}.${PAYLOAD_EXTENSIONS[result.payload.kind]}`;
}

async function payloadToContent(result: LyricsSearchResult, signal: AbortSignal): Promise<string | null> {
  if (result.payload.kind === "ttml") return result.payload.xml;
  if (result.payload.kind === "lrc") return result.payload.synced ?? result.payload.plain;
  if (result.payload.kind === "qrc") return result.payload.raw;

  const response = await fetch(result.payload.fetchUrl, { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch lyrics (${response.status})`);
  }
  const text = await response.text();
  if (text.length === 0) return null;
  return text;
}

// -- Exports ------------------------------------------------------------------

export { payloadToContent, syntheticFilenameForResult, wrapTextAsParseResult };

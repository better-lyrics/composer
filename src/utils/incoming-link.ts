import { readUnisonLyricId } from "@/domain/unison/lyric-id";
import { parseHttpUrl } from "@/utils/url";
import { readYouTubeParam } from "@/utils/youtube-link-params";

// -- Types --------------------------------------------------------------------

interface LinkLocation {
  search: string;
  hash: string;
}

// -- Constants ----------------------------------------------------------------

const SONG_QUERY_PARAM_NAMES = ["title", "artist", "album", "duration", "isrc"] as const;
const LOG_PREFIX = "[IncomingLink]";
const IMPORT_HASH_PREFIX = "#import=";
const LINKED_FILE_PARAM_NAMES = ["audioUrl", "lyricsUrl"] as const;
const UNISON_LYRIC_PARAM = "unisonLyric";

type LinkedFileParam = (typeof LINKED_FILE_PARAM_NAMES)[number];

// -- Params -------------------------------------------------------------------

function readTrimmed(params: URLSearchParams, name: string): string | null {
  const raw = params.get(name);
  if (raw === null) return null;
  const value = raw.trim();
  return value.length > 0 ? value : null;
}

function readLinkedFileUrl(params: URLSearchParams, name: LinkedFileParam): string | null {
  const raw = readTrimmed(params, name);
  return raw === null ? null : (parseHttpUrl(raw)?.href ?? null);
}

function readUnisonLyricParam(params: URLSearchParams): number | null {
  const id = Number(readUnisonLyricId(readTrimmed(params, UNISON_LYRIC_PARAM)) ?? Number.NaN);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function hasLinkedFileParams(params: URLSearchParams): boolean {
  return LINKED_FILE_PARAM_NAMES.some((name) => readTrimmed(params, name) !== null);
}

function linkedFileName(url: string, fallback: string): string {
  const segment = new URL(url).pathname.split("/").at(-1) ?? "";
  try {
    return decodeURIComponent(segment) || fallback;
  } catch (error) {
    console.warn(LOG_PREFIX, "could not decode the linked file name", error);
    return fallback;
  }
}

// -- Detection ----------------------------------------------------------------

function hasIncomingLink({ search, hash }: LinkLocation): boolean {
  if (hash.startsWith(IMPORT_HASH_PREFIX)) return true;
  const params = new URLSearchParams(search);
  if (readYouTubeParam(params) !== null) return true;
  if (readUnisonLyricParam(params) !== null) return true;
  if (hasLinkedFileParams(params)) return true;
  return SONG_QUERY_PARAM_NAMES.some((name) => readTrimmed(params, name) !== null);
}

// -- Exports ------------------------------------------------------------------

export {
  SONG_QUERY_PARAM_NAMES,
  IMPORT_HASH_PREFIX,
  LINKED_FILE_PARAM_NAMES,
  UNISON_LYRIC_PARAM,
  hasIncomingLink,
  hasLinkedFileParams,
  linkedFileName,
  readLinkedFileUrl,
  readTrimmed,
  readUnisonLyricParam,
};
export type { LinkedFileParam };

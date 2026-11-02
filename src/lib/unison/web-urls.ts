import { UNISON_BASE_URL } from "@/lib/unison/client";

// -- URLs ----------------------------------------------------------------------

function unisonProfileUrl(keyId: string): string {
  return `${UNISON_BASE_URL}/curator/${keyId}`;
}

function unisonLyricPageUrl(videoId: string, lyricId: number): string {
  return `${UNISON_BASE_URL}/song/${encodeURIComponent(videoId)}?variantId=${lyricId}`;
}

// -- Exports -------------------------------------------------------------------

export { unisonLyricPageUrl, unisonProfileUrl };

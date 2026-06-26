import { useEffect } from "react";
import { useImportModalStore } from "@/stores/import-modal-store";
import { normalizeIsrc } from "@/utils/isrc";
import { stripQueryParams } from "@/utils/url-params";
import type { LyricsSearchQuery } from "@/utils/lyrics-search/types";

// -- Constants ----------------------------------------------------------------

const IMPORT_PARAM_NAMES = ["title", "artist", "album", "duration", "isrc"] as const;

// -- Helpers ------------------------------------------------------------------

function readTrimmed(params: URLSearchParams, name: string): string | null {
  const raw = params.get(name);
  if (raw === null) return null;
  const value = raw.trim();
  return value.length > 0 ? value : null;
}

function parseDurationSec(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return value;
}

function buildPrefillFromUrl(params: URLSearchParams): LyricsSearchQuery | null {
  const track = readTrimmed(params, "title");
  const artist = readTrimmed(params, "artist");
  const album = readTrimmed(params, "album");
  const durationSec = parseDurationSec(readTrimmed(params, "duration"));
  const isrcRaw = readTrimmed(params, "isrc");
  const isrc = isrcRaw ? normalizeIsrc(isrcRaw) : undefined;
  const videoId = readTrimmed(params, "videoId");

  const prefill: LyricsSearchQuery = {};
  if (track) prefill.track = track;
  if (artist) prefill.artist = artist;
  if (album) prefill.album = album;
  if (durationSec !== undefined) prefill.durationSec = durationSec;
  if (isrc !== undefined) prefill.isrc = isrc;
  if (videoId) prefill.videoId = videoId;

  return Object.keys(prefill).length === 0 ? null : prefill;
}

function useImportFromQuery(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const prefill = buildPrefillFromUrl(params);
    if (prefill === null) return;
    stripQueryParams(IMPORT_PARAM_NAMES);
    useImportModalStore.getState().setDefaultPrefill(prefill);
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { useImportFromQuery };

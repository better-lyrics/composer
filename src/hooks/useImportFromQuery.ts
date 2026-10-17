import { useEffect, useState } from "react";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { getLinkProjectSettled, getPersistenceSettled, markQueryImportSettled } from "@/lib/persistence-settled";
import { isProjectNonEmpty } from "@/lib/project-non-empty";
import { useConfirmStore } from "@/stores/confirm-store";
import { useImportModalStore } from "@/stores/import-modal-store";
import { useProjectStore } from "@/stores/project";
import { normalizeIsrc } from "@/utils/isrc";
import { SONG_QUERY_PARAM_NAMES, readTrimmed } from "@/utils/incoming-link";
import { stripQueryParams } from "@/utils/url-params";
import { readYouTubeParam } from "@/utils/youtube-link-params";
import type { LyricsSearchQuery } from "@/utils/lyrics-search/types";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Composer]";

// -- Helpers ------------------------------------------------------------------

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

function buildMetadataFromUrl(params: URLSearchParams): Partial<ProjectMetadata> | null {
  const patch: Partial<ProjectMetadata> = {};
  const title = readTrimmed(params, "title");
  const artist = readTrimmed(params, "artist");
  const album = readTrimmed(params, "album");
  const duration = parseDurationSec(readTrimmed(params, "duration"));
  const isrcRaw = readTrimmed(params, "isrc");
  const isrc = isrcRaw ? normalizeIsrc(isrcRaw) : undefined;

  if (title) patch.title = title;
  if (artist) patch.artists = [artist];
  if (album) patch.album = album;
  if (duration !== undefined) patch.duration = duration;
  if (isrc !== undefined) patch.isrc = isrc;

  return Object.keys(patch).length === 0 ? null : patch;
}

function hasBootYouTubeParam(): boolean {
  return typeof window !== "undefined" && readYouTubeParam(new URLSearchParams(window.location.search)) !== null;
}

function useImportFromQuery(): void {
  // Read at render: useImportFromYouTube's effect strips this param.
  const [waitsForLink] = useState(hasBootYouTubeParam);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const prefill = buildPrefillFromUrl(params);
    const metaPatch = buildMetadataFromUrl(params);
    if (prefill === null && metaPatch === null) {
      markQueryImportSettled();
      return;
    }
    stripQueryParams(SONG_QUERY_PARAM_NAMES);
    if (prefill !== null) useImportModalStore.getState().setDefaultPrefill(prefill);

    if (metaPatch === null) {
      markQueryImportSettled();
      return;
    }

    let cancelled = false;
    void (async () => {
      await getPersistenceSettled();
      const link = waitsForLink ? await getLinkProjectSettled() : "none";
      if (cancelled || link === "reopened" || link === "failed") return;

      if (link !== "created") {
        // A saved project that fails to read has nothing to overwrite.
        const hasProjectToOverwrite = await isProjectNonEmpty().catch((error) => {
          console.warn(`${LOG_PREFIX} could not read the saved project`, error);
          return false;
        });
        if (hasProjectToOverwrite) {
          const accepted = await useConfirmStore.getState().open({
            title: "Replace song metadata?",
            description: "This link carries song details that will overwrite the metadata on your current project.",
            confirmLabel: "Replace metadata",
            variant: "destructive",
          });
          if (!accepted) return;
        }
      }
      if (cancelled) return;
      useProjectStore.getState().setMetadata(metaPatch);
    })().finally(markQueryImportSettled);

    return () => {
      cancelled = true;
    };
  }, [waitsForLink]);
}

// -- Exports ------------------------------------------------------------------

export { buildMetadataFromUrl, useImportFromQuery };

import { useEffect, useState } from "react";
import type { ProjectMetadata } from "@/domain/project/metadata";
import {
  getLinkProjectSettled,
  getLinkedFilesSettled,
  getPersistenceSettled,
  markQueryImportSettled,
} from "@/lib/persistence-settled";
import { isProjectNonEmpty } from "@/lib/project-non-empty";
import { useConfirmStore } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { normalizeIsrc } from "@/utils/isrc";
import { SONG_QUERY_PARAM_NAMES, hasLinkedFileParams, readTrimmed } from "@/utils/incoming-link";
import { stripQueryParams } from "@/utils/url-params";
import { readYouTubeParam } from "@/utils/youtube-link-params";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Composer]";

// -- Helpers ------------------------------------------------------------------

function parseDurationSec(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return value;
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

type BootLink = "video" | "files" | "none";

function readBootLink(): BootLink {
  if (typeof window === "undefined") return "none";
  const params = new URLSearchParams(window.location.search);
  if (readYouTubeParam(params) !== null) return "video";
  return hasLinkedFileParams(params) ? "files" : "none";
}

function useImportFromQuery(): void {
  // Read at render: the link hooks' effects strip these params.
  const [bootLink] = useState(readBootLink);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const metaPatch = buildMetadataFromUrl(params);
    if (metaPatch === null) {
      markQueryImportSettled();
      return;
    }
    stripQueryParams(SONG_QUERY_PARAM_NAMES);

    let cancelled = false;
    void (async () => {
      await getPersistenceSettled();
      const link =
        bootLink === "video"
          ? await getLinkProjectSettled()
          : bootLink === "files"
            ? await getLinkedFilesSettled()
            : "none";
      if (cancelled || link === "reopened" || link === "failed") return;

      if (link !== "created" && link !== "replaced") {
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
  }, [bootLink]);
}

// -- Exports ------------------------------------------------------------------

export { buildMetadataFromUrl, useImportFromQuery };

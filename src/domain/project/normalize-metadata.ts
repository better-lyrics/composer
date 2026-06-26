import type { ProjectMetadata } from "@/domain/project/metadata";

// -- Types --------------------------------------------------------------------

interface StoredMetadata extends Partial<Omit<ProjectMetadata, "artists">> {
  artist?: string;
  artists?: string[];
}

// -- Normalizer ---------------------------------------------------------------

function normalizeLoadedMetadata(raw: StoredMetadata): ProjectMetadata {
  const artists = raw.artists ?? (raw.artist?.trim() ? [raw.artist] : []);
  const { artist: _legacy, ...rest } = raw;
  return {
    title: raw.title ?? "",
    album: raw.album ?? "",
    duration: raw.duration ?? 0,
    ...rest,
    artists,
  };
}

// -- Exports ------------------------------------------------------------------

export { normalizeLoadedMetadata };
export type { StoredMetadata };

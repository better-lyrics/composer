import type { ProjectMetadata } from "@/domain/project/metadata";

// -- Types --------------------------------------------------------------------

interface StoredMetadata extends Partial<Omit<ProjectMetadata, "artists">> {
  artist?: string;
  artists?: string[];
}

// -- Normalizer ---------------------------------------------------------------

// Every optional key is spelled out so that spreading the result over existing
// metadata clears the fields the loaded record omits. Returning a partial object
// would let the previous project's ISRC, songwriters or extra fields survive an
// import and end up in the newly exported TTML.
function normalizeLoadedMetadata(raw: StoredMetadata | null | undefined): ProjectMetadata {
  const source = raw ?? {};
  const artists = source.artists ?? (source.artist?.trim() ? [source.artist] : []);
  const { artist: _legacy, ...rest } = source;
  return {
    isrc: undefined,
    songwriters: undefined,
    extra: undefined,
    language: undefined,
    thumbnailDataUrl: undefined,
    thumbnailForVideoId: undefined,
    ...rest,
    title: source.title ?? "",
    album: source.album ?? "",
    duration: source.duration ?? 0,
    artists,
  };
}

// -- Exports ------------------------------------------------------------------

export { normalizeLoadedMetadata };

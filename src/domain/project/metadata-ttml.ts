import type { ProjectMetadata } from "@/domain/project/metadata";

// -- Types --------------------------------------------------------------------

interface MetaPair {
  key: string;
  value: string;
}

// -- Mapping ------------------------------------------------------------------

function toComposerMeta(metadata: ProjectMetadata): MetaPair[] {
  const pairs: MetaPair[] = [];
  for (const artist of metadata.artists) if (artist) pairs.push({ key: "artists", value: artist });
  if (metadata.album) pairs.push({ key: "album", value: metadata.album });
  if (metadata.isrc) pairs.push({ key: "isrc", value: metadata.isrc });
  for (const writer of metadata.songwriters ?? []) if (writer) pairs.push({ key: "songwriter", value: writer });
  for (const key of Object.keys(metadata.extra ?? {}).toSorted()) {
    const value = metadata.extra?.[key];
    if (value) pairs.push({ key, value });
  }
  return pairs;
}

function fromComposerMeta(pairs: MetaPair[]): Partial<ProjectMetadata> {
  const out: Partial<ProjectMetadata> = {};
  const artists: string[] = [];
  const songwriters: string[] = [];
  const extra: Record<string, string> = {};
  for (const { key, value } of pairs) {
    if (!key || !value) continue;
    switch (key) {
      case "artists":
        artists.push(value);
        break;
      case "album":
        out.album = value;
        break;
      case "isrc":
        out.isrc = value;
        break;
      case "musicName":
        if (out.title == null) out.title = value;
        break;
      case "songwriter":
      case "songwriters":
        songwriters.push(value);
        break;
      default:
        extra[key] = value;
    }
  }
  if (artists.length) out.artists = artists;
  if (songwriters.length) out.songwriters = songwriters;
  if (Object.keys(extra).length) out.extra = extra;
  return out;
}

// -- Exports ------------------------------------------------------------------

export { fromComposerMeta, toComposerMeta };
export type { MetaPair };

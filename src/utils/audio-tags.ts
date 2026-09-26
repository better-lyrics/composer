import type { ICommonTagsResult } from "music-metadata";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { normalizeIsrc } from "@/utils/isrc";

// -- Mapper -------------------------------------------------------------------

function audioTagsToMetadata(common: Partial<ICommonTagsResult>): Partial<ProjectMetadata> {
  const out: Partial<ProjectMetadata> = {};
  if (common.title) out.title = common.title;
  const artists = common.artists?.filter(Boolean) ?? (common.artist ? [common.artist] : []);
  if (artists.length) out.artists = artists;
  if (common.album) out.album = common.album;
  const isrc = common.isrc?.map(normalizeIsrc).find(Boolean);
  if (isrc) out.isrc = isrc;
  return out;
}

// -- Exports ------------------------------------------------------------------

export { audioTagsToMetadata };

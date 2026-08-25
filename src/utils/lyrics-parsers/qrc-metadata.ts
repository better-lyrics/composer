import type { ProjectMetadata } from "@/domain/project/metadata";
import { MS_PER_SECOND } from "@/utils/lyrics-parsers/qrc";

// -- Constants ----------------------------------------------------------------

const HEADER_TAG_REGEX = /\[([a-z]+):([^\]]*)\]/gi;

// -- Types --------------------------------------------------------------------

interface HeaderTags {
  metadata: Partial<ProjectMetadata>;
  offsetSeconds: number;
}

// -- Header tags --------------------------------------------------------------

function parseHeaderTags(lyricContent: string): HeaderTags {
  const metadata: Partial<ProjectMetadata> = {};
  const extra: Record<string, string> = {};
  let offsetSeconds = 0;

  for (const match of lyricContent.matchAll(HEADER_TAG_REGEX)) {
    const tag = match[1].toLowerCase();
    const value = match[2].trim();
    if (tag === "ti" && value) metadata.title = value;
    else if (tag === "ar" && value) metadata.artists = [value];
    else if (tag === "al" && value) metadata.album = value;
    else if (tag === "by" && value) extra.qrcTranscriber = value;
    else if (tag === "offset") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) offsetSeconds = parsed / MS_PER_SECOND;
    }
  }

  if (Object.keys(extra).length > 0) metadata.extra = extra;
  return { metadata, offsetSeconds };
}

// -- Exports ------------------------------------------------------------------

export { parseHeaderTags };
export type { HeaderTags };

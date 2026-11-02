import { normalizeLanguageTag } from "@/domain/project/language";
import type { ProjectMetadata } from "@/domain/project/metadata";
import type { UnisonLyric, UnisonLyricsFormat } from "@/lib/unison/api-types";
import { startVideoProject } from "@/lib/unison/video-project";
import { useProjectStore } from "@/stores/project";
import { normalizeIsrc } from "@/utils/isrc";
import type { ParseResult } from "@/utils/lyrics-parsers";
import { skippedLinesMessage } from "@/utils/lyrics-parsers/shared";
import { type LyricsRead, readLyricsFile, replaceWithParsedLyrics } from "@/views/lyrics-import-modal/import-lyrics";
import { toast } from "sonner";

// -- Types ---------------------------------------------------------------------

interface OpenUnisonLyricOptions {
  link: boolean;
  navigate: (path: string) => void;
}

// -- Constants -----------------------------------------------------------------

const FILE_EXTENSIONS: Record<UnisonLyricsFormat, string> = { ttml: "ttml", lrc: "lrc", plain: "txt" };

// -- Helpers -------------------------------------------------------------------

function unisonSongDetails(lyric: UnisonLyric): Partial<ProjectMetadata> {
  return {
    title: lyric.song,
    artists: lyric.artist ? [lyric.artist] : [],
    album: lyric.album ?? "",
    isrc: lyric.isrc ? normalizeIsrc(lyric.isrc) : undefined,
    language: lyric.language ? normalizeLanguageTag(lyric.language) : undefined,
  };
}

// Unison details are the submitted song identity, so they win over the document's own.
function withUnisonDetails(parsed: ParseResult, lyric: UnisonLyric): ParseResult {
  return { ...parsed, metadata: { ...parsed.metadata, ...unisonSongDetails(lyric) } };
}

// -- Reading -------------------------------------------------------------------

function readUnisonLyric(lyric: Pick<UnisonLyric, "song" | "format" | "lyrics">): LyricsRead {
  return readLyricsFile(`${lyric.song}.${FILE_EXTENSIONS[lyric.format]}`, lyric.lyrics);
}

// -- Opening -------------------------------------------------------------------

async function openUnisonLyric(lyric: UnisonLyric, { link, navigate }: OpenUnisonLyricOptions): Promise<void> {
  const read = readUnisonLyric(lyric);
  if (read.status === "unreadable") {
    toast.error(read.message);
    return;
  }
  await startVideoProject({
    videoId: lyric.videoId,
    title: lyric.song || lyric.videoId,
    prepare: () => {
      const skipped = replaceWithParsedLyrics(withUnisonDetails(read.parsed, lyric));
      const project = useProjectStore.getState();
      project.clearHistory();
      if (link) project.linkUnisonLyric(String(lyric.id));
      if (skipped > 0) toast.warning(skippedLinesMessage(skipped));
    },
    navigate,
  });
}

// -- Exports -------------------------------------------------------------------

export { openUnisonLyric, readUnisonLyric };

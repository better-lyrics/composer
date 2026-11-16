import { toast } from "sonner";
import { artistCredit } from "@/domain/project/display-title";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { normalizeLanguageTag } from "@/domain/project/language";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { projectsByLyricId } from "@/domain/unison/linked-projects";
import { isOwnLyric, lyricOwnerName } from "@/domain/unison/ownership";
import { openProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { getQueryImportSettled } from "@/lib/persistence-settled";
import type { UnisonLyric, UnisonLyricsFormat } from "@/lib/unison/api-types";
import { readUnisonSession } from "@/lib/unison/session";
import {
  type VideoProjectStart,
  announceVideoProject,
  createVideoProject,
  loadVideoProject,
  startVideoProject,
} from "@/lib/unison/video-project";
import { useProjectStore } from "@/stores/project";
import { EDITOR_PATH } from "@/utils/app-routes";
import { normalizeIsrc } from "@/utils/isrc";
import type { ParseResult } from "@/utils/lyrics-parsers";
import { skippedLinesMessage } from "@/utils/lyrics-parsers/shared";
import { ownerLyric } from "@/utils/unison-suggest-copy";
import { showLinkedProjectReopenedToast, showSuggestOpenedToast } from "@/utils/unison-toast";
import { type LyricsRead, readLyricsFile, replaceWithParsedLyrics } from "@/views/lyrics-import-modal/import-lyrics";

// -- Types ---------------------------------------------------------------------

interface OpenUnisonLyricOptions {
  link: boolean;
  navigate: (path: string) => void;
}

// -- Constants -----------------------------------------------------------------

const FILE_EXTENSIONS: Record<UnisonLyricsFormat, string> = { ttml: "ttml", lrc: "lrc", plain: "txt" };

// -- Helpers -------------------------------------------------------------------

type UnisonSongIdentity = Pick<UnisonLyric, "song" | "artist" | "album" | "isrc" | "language">;

function unisonSongDetails(lyric: UnisonSongIdentity): Partial<ProjectMetadata> {
  const isrc = lyric.isrc ? normalizeIsrc(lyric.isrc) : undefined;
  const language = lyric.language ? normalizeLanguageTag(lyric.language) : undefined;
  return {
    title: lyric.song,
    ...(lyric.artist && { artists: [lyric.artist] }),
    ...(lyric.album && { album: lyric.album }),
    ...(isrc && { isrc }),
    ...(language && { language }),
  };
}

// Unison details are the submitted song identity, so they win over the document's own.
// Unison keeps several artists as one credit, so a document list that makes the same credit stays a list.
function withUnisonDetails(parsed: ParseResult, lyric: UnisonSongIdentity): ParseResult {
  const ownArtists = parsed.metadata.artists;
  const sameCredit = ownArtists !== undefined && artistCredit(ownArtists) === lyric.artist;
  return {
    ...parsed,
    metadata: { ...parsed.metadata, ...unisonSongDetails(lyric), ...(sameCredit ? { artists: ownArtists } : {}) },
  };
}

// -- Reading -------------------------------------------------------------------

function readUnisonLyric(lyric: Pick<UnisonLyric, "song" | "format" | "lyrics">): LyricsRead {
  return readLyricsFile(`${lyric.song}.${FILE_EXTENSIONS[lyric.format]}`, lyric.lyrics);
}

// -- Opening -------------------------------------------------------------------

function unisonLyricStart(lyric: UnisonLyric, { link, navigate }: OpenUnisonLyricOptions): VideoProjectStart | null {
  const read = readUnisonLyric(lyric);
  if (read.status === "unreadable") {
    toast.error(read.message);
    return null;
  }
  return {
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
  };
}

async function openUnisonLyric(lyric: UnisonLyric, options: OpenUnisonLyricOptions): Promise<void> {
  const start = unisonLyricStart(lyric, options);
  if (start) await startVideoProject(start);
}

type LinkOpenOutcome = "created" | "reopened" | "failed";

function linkedLyricLabel(lyric: UnisonLyric): string | null {
  return isOwnLyric(lyric, readUnisonSession()?.keyId ?? null) ? null : ownerLyric(lyricOwnerName(lyric));
}

async function reopenLinkedProject(
  lyric: UnisonLyric,
  projectId: string,
  navigate: (path: string) => void,
): Promise<LinkOpenOutcome> {
  await openProject(projectId);
  navigate(EDITOR_PATH);
  showLinkedProjectReopenedToast(linkedLyricLabel(lyric));
  return "reopened";
}

async function openUnisonLyricFromLink(
  lyric: UnisonLyric,
  entries: readonly ProjectIndexEntry[] | null,
  navigate: (path: string) => void,
): Promise<LinkOpenOutcome> {
  const linked = entries ? projectsByLyricId(entries).get(String(lyric.id)) : undefined;
  if (linked) return reopenLinkedProject(lyric, linked.id, navigate);
  const start = unisonLyricStart(lyric, { link: true, navigate });
  const started = start && (await createVideoProject(start));
  if (!started) return "failed";
  useProjectStore.getState().setActiveTab("edit");
  void getQueryImportSettled().then(() => {
    if (openProjectIdSnapshot() !== started.newId) return;
    const label = linkedLyricLabel(lyric);
    if (label === null) announceVideoProject(started);
    else showSuggestOpenedToast(label);
  });
  void loadVideoProject(lyric.videoId, started);
  return "created";
}

// -- Exports -------------------------------------------------------------------

export { openUnisonLyric, openUnisonLyricFromLink, readUnisonLyric, withUnisonDetails };

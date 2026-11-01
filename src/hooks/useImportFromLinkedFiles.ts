import { useLoadAudioFile } from "@/hooks/useLoadAudioFile";
import { openLyricsFileAsNewProject } from "@/lib/open-lyrics-as-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { type LinkProjectOutcome, getPersistenceSettled, markLinkedFilesSettled } from "@/lib/persistence-settled";
import { useAudioStore } from "@/stores/audio";
import { LINKED_FILE_PARAM_NAMES, hasLinkedFileParams, linkedFileName, readLinkedFileUrl } from "@/utils/incoming-link";
import { stripQueryParams } from "@/utils/url-params";
import { readYouTubeParam } from "@/utils/youtube-link-params";
import { isLyricsImportFileName } from "@/views/lyrics-import-modal/accepted-files";
import { type ImportContext, useImportContext } from "@/views/lyrics-import-modal/import-lyrics";
import { importLyricsFile, importLyricsText } from "@/views/lyrics-import-modal/import-lyrics-source";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// -- Types --------------------------------------------------------------------

interface BootLinkedFiles {
  present: boolean;
  skippedForVideo: boolean;
  audioUrl: string | null;
  lyricsUrl: string | null;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Boot]";
const AUDIO_FALLBACK_NAME = "Linked audio";
const LYRICS_FALLBACK_NAME = "Linked lyrics";
const NO_LINKED_FILES: BootLinkedFiles = { present: false, skippedForVideo: false, audioUrl: null, lyricsUrl: null };

// -- Helpers ------------------------------------------------------------------

class LinkedFileError extends Error {}

function readBootLinkedFiles(): BootLinkedFiles {
  if (typeof window === "undefined") return NO_LINKED_FILES;
  const params = new URLSearchParams(window.location.search);
  if (!hasLinkedFileParams(params)) return NO_LINKED_FILES;
  return {
    present: true,
    skippedForVideo: readYouTubeParam(params) !== null,
    audioUrl: readLinkedFileUrl(params, "audioUrl"),
    lyricsUrl: readLinkedFileUrl(params, "lyricsUrl"),
  };
}

async function fetchLinkedFile(url: string, fallbackName: string, signal: AbortSignal): Promise<File> {
  const name = linkedFileName(url, fallbackName);
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new LinkedFileError(`Couldn't download ${name}. The server might not allow downloads from other sites.`, {
      cause: error,
    });
  }
  if (!response.ok) throw new LinkedFileError(`Couldn't download ${name} (HTTP ${response.status})`);
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type });
}

function linkedFileErrorMessage(error: unknown): string {
  return error instanceof LinkedFileError ? error.message : "Couldn't download the linked file";
}

function isActiveFile(file: File): boolean {
  const source = useAudioStore.getState().source;
  return source?.type === "file" && source.file === file;
}

async function openLinkedLyricsAsProject(lyrics: File): Promise<LinkProjectOutcome> {
  return (await openLyricsFileAsNewProject(lyrics)) === null ? "failed" : "created";
}

async function importLinkedLyrics(lyrics: File, ctx: ImportContext): Promise<void> {
  if (isLyricsImportFileName(lyrics.name)) await importLyricsFile(lyrics, ctx);
  else await importLyricsText(await lyrics.text(), ctx);
}

async function applyLinkedFiles(
  audio: File | null,
  lyrics: File | null,
  loadAudioFile: (file: File) => Promise<void>,
  ctx: ImportContext,
): Promise<LinkProjectOutcome> {
  await getPersistenceSettled();
  if (audio === null) return lyrics ? openLinkedLyricsAsProject(lyrics) : "failed";

  const before = openProjectIdSnapshot();
  await loadAudioFile(audio);
  if (!isActiveFile(audio)) return lyrics ? openLinkedLyricsAsProject(lyrics) : "failed";

  const placed = openProjectIdSnapshot();
  if (lyrics) await importLinkedLyrics(lyrics, ctx);
  return placed === before ? "current" : "created";
}

// -- Hook ---------------------------------------------------------------------

function useImportFromLinkedFiles(): void {
  // Read at render: the effect below strips these params.
  const [links] = useState(readBootLinkedFiles);
  const active = links.present && !links.skippedForVideo;

  const loadAudioFile = useLoadAudioFile();
  const ctx = useImportContext("Link");
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const appliedRef = useRef(false);
  const progressToastRef = useRef<string | number | undefined>(undefined);

  const audioQuery = useQuery({
    queryKey: ["linked-file", links.audioUrl],
    enabled: active && links.audioUrl !== null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    queryFn: ({ signal }) => fetchLinkedFile(links.audioUrl as string, AUDIO_FALLBACK_NAME, signal),
  });
  const lyricsQuery = useQuery({
    queryKey: ["linked-file", links.lyricsUrl],
    enabled: active && links.lyricsUrl !== null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    queryFn: ({ signal }) => fetchLinkedFile(links.lyricsUrl as string, LYRICS_FALLBACK_NAME, signal),
  });

  useEffect(() => {
    if (!links.present) {
      markLinkedFilesSettled("none");
      return;
    }
    stripQueryParams(LINKED_FILE_PARAM_NAMES);
    if (links.skippedForVideo) {
      toast.warning("This link opens a YouTube video, so its audio and lyrics files were skipped");
      markLinkedFilesSettled("none");
      return;
    }
    if (links.audioUrl === null && links.lyricsUrl === null) {
      toast.error("This link's audio or lyrics address isn't a web address");
      markLinkedFilesSettled("failed");
      return;
    }
    if (links.audioUrl !== null) {
      progressToastRef.current = toast.loading(`Downloading ${linkedFileName(links.audioUrl, AUDIO_FALLBACK_NAME)}`);
    }
    return () => {
      if (!appliedRef.current) markLinkedFilesSettled("failed");
    };
  }, [links]);

  const audioDone = links.audioUrl === null || audioQuery.status !== "pending";
  const lyricsDone = links.lyricsUrl === null || lyricsQuery.status !== "pending";
  const hasUrl = links.audioUrl !== null || links.lyricsUrl !== null;

  useEffect(() => {
    if (!active || !hasUrl || !audioDone || !lyricsDone || appliedRef.current) return;
    appliedRef.current = true;

    const progressId = progressToastRef.current;
    if (audioQuery.error) toast.error(linkedFileErrorMessage(audioQuery.error), { id: progressId });
    else if (progressId !== undefined) toast.dismiss(progressId);
    if (lyricsQuery.error) toast.error(linkedFileErrorMessage(lyricsQuery.error));

    applyLinkedFiles(audioQuery.data ?? null, lyricsQuery.data ?? null, loadAudioFile, ctxRef.current)
      .then(markLinkedFilesSettled)
      .catch((error: unknown) => {
        console.error(`${LOG_PREFIX} could not open the linked files`, error);
        toast.error("Couldn't open the linked files");
        markLinkedFilesSettled("failed");
      });
  }, [
    active,
    hasUrl,
    audioDone,
    lyricsDone,
    audioQuery.data,
    audioQuery.error,
    lyricsQuery.data,
    lyricsQuery.error,
    loadAudioFile,
  ]);
}

// -- Exports ------------------------------------------------------------------

export { useImportFromLinkedFiles };

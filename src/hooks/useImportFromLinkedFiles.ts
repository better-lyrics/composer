import { probeAudioFile } from "@/audio/probe-audio-file";
import { type AudioFileLoadMode, useLoadAudioFile } from "@/hooks/useLoadAudioFile";
import { openLyricsFileAsNewProject } from "@/lib/open-lyrics-as-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { type LinkProjectOutcome, getPersistenceSettled, markLinkedFilesSettled } from "@/lib/persistence-settled";
import { isActiveAudioFile } from "@/stores/audio";
import {
  LINKED_FILE_PARAM_NAMES,
  type LinkedFileParam,
  hasLinkedFileParams,
  linkedFileName,
  readLinkedFileUrl,
  readTrimmed,
} from "@/utils/incoming-link";
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
  invalid: LinkedFileParam[];
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Boot]";
const AUDIO_FALLBACK_NAME = "Linked audio";
const LYRICS_FALLBACK_NAME = "Linked lyrics";
const RESPONSE_TIMEOUT_MS = 30_000;
const NO_LINKED_FILES: BootLinkedFiles = {
  present: false,
  skippedForVideo: false,
  audioUrl: null,
  lyricsUrl: null,
  invalid: [],
};
const LINKED_FILE_NOUNS: Record<LinkedFileParam, string> = { audioUrl: "audio", lyricsUrl: "lyrics" };

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
    invalid: LINKED_FILE_PARAM_NAMES.filter(
      (name) => readTrimmed(params, name) !== null && readLinkedFileUrl(params, name) === null,
    ),
  };
}

async function fetchLinkedFile(url: string, fallbackName: string, signal: AbortSignal): Promise<File> {
  const name = linkedFileName(url, fallbackName);
  // Only the wait for a response times out: a large file on a slow connection keeps downloading.
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), RESPONSE_TIMEOUT_MS);
  let blob: Blob;
  try {
    const response = await fetch(url, { signal: AbortSignal.any([signal, timeout.signal]) });
    clearTimeout(timer);
    if (!response.ok) throw new LinkedFileError(`Couldn't download ${name} (HTTP ${response.status})`);
    blob = await response.blob();
  } catch (error) {
    clearTimeout(timer);
    if (signal.aborted || error instanceof LinkedFileError) throw error;
    if (timeout.signal.aborted)
      throw new LinkedFileError(`Couldn't download ${name}: the server took too long`, { cause: error });
    throw new LinkedFileError(`Couldn't download ${name}. The server might not allow downloads from other sites.`, {
      cause: error,
    });
  }
  return new File([blob], name, { type: blob.type });
}

async function fetchLinkedLyrics(url: string, signal: AbortSignal): Promise<File> {
  const file = await fetchLinkedFile(url, LYRICS_FALLBACK_NAME, signal);
  if (file.type.startsWith("text/html")) throw new LinkedFileError(`${file.name} is a web page, not a lyrics file`);
  return file;
}

function linkedFileErrorMessage(error: unknown): string {
  return error instanceof LinkedFileError ? error.message : "Couldn't download the linked file";
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
  loadAudioFile: (file: File, mode: AudioFileLoadMode) => Promise<void>,
  ctx: ImportContext,
): Promise<LinkProjectOutcome> {
  await getPersistenceSettled();
  if (audio === null) return lyrics ? openLinkedLyricsAsProject(lyrics) : "failed";

  // The store learns the duration only once the player loads, and only the probe tells unplayable from superseded.
  const probe = lyrics ? await probeAudioFile(audio) : null;
  const before = openProjectIdSnapshot();
  await loadAudioFile(audio, "new-song");
  if (!isActiveAudioFile(audio)) return lyrics && probe?.ok === false ? openLinkedLyricsAsProject(lyrics) : "failed";

  const placed = openProjectIdSnapshot();
  if (lyrics) await importLinkedLyrics(lyrics, { ...ctx, audioDuration: probe?.ok ? probe.duration : 0 });
  return placed === before ? "replaced" : "created";
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
    queryFn: ({ signal }) => fetchLinkedLyrics(links.lyricsUrl as string, signal),
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
    for (const name of links.invalid) {
      toast.error(`The link's ${LINKED_FILE_NOUNS[name]} address isn't a web address`);
    }
    if (links.audioUrl === null && links.lyricsUrl === null) {
      markLinkedFilesSettled("none");
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

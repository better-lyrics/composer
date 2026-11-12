import { namedArtists } from "@/domain/project/display-title";
import { readModalDraft, writeModalDraft } from "@/lib/modal-drafts";
import { type AudioSource, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { fileNameWithoutExtension } from "@/utils/file-name";
import type { LyricsSearchQuery } from "@/utils/lyrics-search/types";
import { formatDuration } from "@/views/lyrics-import-modal/duration-input-utils";

// -- Interfaces ---------------------------------------------------------------

interface SearchInputs {
  track: string;
  artist: string;
  album: string;
  duration: string;
  videoId: string;
  isrc?: string;
}

// -- Constants ----------------------------------------------------------------

const EMPTY_SEARCH_INPUTS: SearchInputs = { track: "", artist: "", album: "", duration: "", videoId: "" };

// -- Helpers ------------------------------------------------------------------

function inputsFromQuery(query: LyricsSearchQuery): SearchInputs {
  return {
    track: query.track ?? "",
    artist: query.artist ?? "",
    album: query.album ?? "",
    duration: typeof query.durationSec === "number" ? formatDuration(query.durationSec) : "",
    videoId: query.videoId ?? "",
    isrc: query.isrc,
  };
}

// A placeholder title (the video id, or the file name before tags load) is not a song name worth searching.
function isPlaceholderTitle(title: string, source: AudioSource): boolean {
  if (source?.type === "youtube") return title === source.videoId;
  if (source?.type === "file") return title === fileNameWithoutExtension(source.file.name);
  return false;
}

function projectSearchQuery(): LyricsSearchQuery {
  const { metadata } = useProjectStore.getState();
  const { source, duration: audioDuration } = useAudioStore.getState();
  const durationSec = metadata.duration > 0 ? metadata.duration : audioDuration;
  return {
    track: metadata.title && !isPlaceholderTitle(metadata.title, source) ? metadata.title : undefined,
    artist: namedArtists(metadata.artists)[0],
    album: metadata.album || undefined,
    durationSec: durationSec > 0 ? durationSec : undefined,
    videoId: source?.type === "youtube" ? source.videoId : undefined,
    isrc: metadata.isrc,
  };
}

function initialSearchInputs(prefill: LyricsSearchQuery | null): SearchInputs {
  return readModalDraft("lyrics-search") ?? inputsFromQuery(prefill ?? projectSearchQuery());
}

function saveSearchDraft(inputs: SearchInputs): void {
  writeModalDraft("lyrics-search", inputs);
}

// -- Exports ------------------------------------------------------------------

export { EMPTY_SEARCH_INPUTS, initialSearchInputs, saveSearchDraft };
export type { SearchInputs };

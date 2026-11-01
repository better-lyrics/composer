import type { SourceMetadata } from "@/domain/project/source-metadata";
import type { AudioSource } from "@/stores/audio";
import { audioTagsToMetadata } from "@/utils/audio-tags";
import { fileNameWithoutExtension } from "@/utils/file-name";
import { normalizeIsrc } from "@/utils/isrc";

// -- Types --------------------------------------------------------------------

interface VideoSongDetails {
  filename?: string;
  title?: string;
  artist?: string;
  album?: string;
  isrc?: string;
}

interface PendingSwap {
  target: AudioSource;
  baseline: Promise<SourceMetadata>;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[SourceMetadata]";

// -- State --------------------------------------------------------------------

let pendingSwap: PendingSwap | null = null;

// -- Functions ----------------------------------------------------------------

async function readAudioTags(file: File): Promise<SourceMetadata> {
  const { parseBlob } = await import("music-metadata");
  const { common } = await parseBlob(file);
  return audioTagsToMetadata(common);
}

async function fileSourceMetadata(file: File): Promise<SourceMetadata> {
  const fromName = { title: fileNameWithoutExtension(file.name) };
  try {
    return { ...fromName, ...(await readAudioTags(file)) };
  } catch (error) {
    console.warn(LOG_PREFIX, "could not read audio tags", error);
    return fromName;
  }
}

function videoSourceMetadata(videoId: string, details?: VideoSongDetails): SourceMetadata {
  const metadata: SourceMetadata = { title: details?.title || details?.filename || videoId };
  if (details?.artist) metadata.artists = [details.artist];
  if (details?.album) metadata.album = details.album;
  const isrc = details?.isrc ? normalizeIsrc(details.isrc) : undefined;
  if (isrc) metadata.isrc = isrc;
  return metadata;
}

function sourceMetadata(source: AudioSource): Promise<SourceMetadata> {
  if (source?.type === "file") return fileSourceMetadata(source.file);
  if (source?.type === "youtube") return Promise.resolve({ title: source.videoId, ...source.details });
  return Promise.resolve({});
}

// A replace that overtakes an unsettled one compares against the source the user started from.
function beginSourceSwap(previous: AudioSource, target: AudioSource): Promise<SourceMetadata> {
  const baseline = pendingSwap?.target === previous ? pendingSwap.baseline : sourceMetadata(previous);
  pendingSwap = { target, baseline };
  return baseline;
}

function settleSourceSwap(target: AudioSource): void {
  if (pendingSwap?.target === target) pendingSwap = null;
}

// -- Exports ------------------------------------------------------------------

export { beginSourceSwap, fileSourceMetadata, readAudioTags, settleSourceSwap, videoSourceMetadata };

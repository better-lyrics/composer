import type { SourceMetadata } from "@/domain/project/source-metadata";
import { appQueryClient } from "@/lib/app-query-client";
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

// -- Constants ----------------------------------------------------------------

const YOUTUBE_TUNNEL_QUERY = "youtube-tunnel";
const LOG_PREFIX = "[SourceMetadata]";

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

function cachedVideoDetails(videoId: string): VideoSongDetails | undefined {
  const cached = appQueryClient.getQueriesData<VideoSongDetails>({ queryKey: [YOUTUBE_TUNNEL_QUERY, videoId] });
  return cached.find(([, details]) => details !== undefined)?.[1];
}

function sourceMetadata(source: AudioSource): Promise<SourceMetadata> {
  if (source?.type === "file") return fileSourceMetadata(source.file);
  if (source?.type === "youtube")
    return Promise.resolve(videoSourceMetadata(source.videoId, cachedVideoDetails(source.videoId)));
  return Promise.resolve({});
}

// -- Exports ------------------------------------------------------------------

export { YOUTUBE_TUNNEL_QUERY, fileSourceMetadata, readAudioTags, sourceMetadata, videoSourceMetadata };

// -- Constants ----------------------------------------------------------------

const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"]);
const YOUTU_BE_HOST = "youtu.be";
const PATH_PREFIX_VIDEO_ID: Record<string, true> = { shorts: true, embed: true, live: true, v: true };
const INVALID_YOUTUBE_LINK_MESSAGE = "That doesn't look like a valid YouTube URL or ID";
const EMPTY_YOUTUBE_LINK_MESSAGE = "Paste a YouTube link first";

// -- Functions ----------------------------------------------------------------

function parseLink(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    // People paste links like "youtube.com/watch?v=..." without a scheme.
    try {
      return new URL(`https://${input}`);
    } catch {
      return null;
    }
  }
}

function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (VIDEO_ID_REGEX.test(trimmed)) return trimmed;

  const url = parseLink(trimmed);
  if (!url) return null;

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  if (url.hostname === YOUTU_BE_HOST) {
    const candidate = url.pathname.slice(1).split("/")[0];
    return VIDEO_ID_REGEX.test(candidate) ? candidate : null;
  }

  if (YOUTUBE_HOSTS.has(url.hostname)) {
    const v = url.searchParams.get("v");
    if (v && VIDEO_ID_REGEX.test(v)) return v;

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && PATH_PREFIX_VIDEO_ID[parts[0]]) {
      return VIDEO_ID_REGEX.test(parts[1]) ? parts[1] : null;
    }
  }

  return null;
}

// -- Exports ------------------------------------------------------------------

type YouTubeLinkRead = { videoId: string; error?: never } | { videoId?: never; error: string };

function readYouTubeLink(value: string, invalidMessage = INVALID_YOUTUBE_LINK_MESSAGE): YouTubeLinkRead {
  if (value.trim() === "") return { error: EMPTY_YOUTUBE_LINK_MESSAGE };
  const videoId = extractVideoId(value);
  return videoId ? { videoId } : { error: invalidMessage };
}

export { extractVideoId, readYouTubeLink };

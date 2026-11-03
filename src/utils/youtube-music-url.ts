// -- Constants -----------------------------------------------------------------

// YouTube answers a missing thumbnail with a 120 px wide grey placeholder instead of an error.
const YOUTUBE_PLACEHOLDER_THUMBNAIL_WIDTH = 120;

// -- Functions -----------------------------------------------------------------

function youTubeMusicUrl(videoId: string): string {
  return `https://music.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

function youTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`;
}

// -- Exports -------------------------------------------------------------------

export { YOUTUBE_PLACEHOLDER_THUMBNAIL_WIDTH, youTubeMusicUrl, youTubeThumbnailUrl };

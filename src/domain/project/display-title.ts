// -- Derivation ---------------------------------------------------------------

function displayTitle(title: string): string {
  return title || "Untitled";
}

function quotedTitle(title: string): string {
  return `“${displayTitle(title)}”`;
}

function namedArtists(artists: readonly string[]): string[] {
  return artists.filter((artist) => artist.trim() !== "");
}

function hasArtists(artists: readonly string[]): boolean {
  return namedArtists(artists).length > 0;
}

function displayArtists(artists: readonly string[]): string {
  return namedArtists(artists).join(", ") || "No artist";
}

function youtubeSourceTitle(title: string, videoId: string): string {
  return title && title !== videoId ? title : videoId;
}

// -- Exports ------------------------------------------------------------------

export { displayTitle, quotedTitle, displayArtists, hasArtists, youtubeSourceTitle };

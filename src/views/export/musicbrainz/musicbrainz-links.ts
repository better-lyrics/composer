// -- Constants ----------------------------------------------------------------

const MUSICBRAINZ_SITE = "https://musicbrainz.org";
const COVER_ART_ARCHIVE = "https://coverartarchive.org";

// -- URLs ---------------------------------------------------------------------

function recordingSearchPageUrl(title: string): string {
  const url = new URL("/search", MUSICBRAINZ_SITE);
  url.searchParams.set("type", "recording");
  url.searchParams.set("query", title);
  return url.toString();
}

const recordingPageUrl = (recordingId: string): string =>
  `${MUSICBRAINZ_SITE}/recording/${encodeURIComponent(recordingId)}`;

const releaseGroupCoverUrl = (releaseGroupId: string): string =>
  `${COVER_ART_ARCHIVE}/release-group/${encodeURIComponent(releaseGroupId)}/front-250`;

// -- Exports ------------------------------------------------------------------

export { recordingPageUrl, recordingSearchPageUrl, releaseGroupCoverUrl };

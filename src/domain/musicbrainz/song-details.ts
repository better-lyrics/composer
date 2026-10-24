import type { MbRecording, MbRelease } from "@/domain/musicbrainz/types";

// -- Constants ----------------------------------------------------------------

const SONGWRITER_TYPES: ReadonlySet<string> = new Set(["writer", "composer", "lyricist"]);
const UNDATED = "9999";

// -- Types --------------------------------------------------------------------

interface SongDetails {
  recordingId: string;
  title: string;
  album: string | null;
  releaseTitle: string | null;
  isrc: string | null;
  isrcs: string[];
  artists: string[];
  songwriters: string[];
  coverReleaseGroupId: string | null;
  releaseYear: string | null;
  lengthSec: number | null;
}

// -- Releases -----------------------------------------------------------------

const isOfficialStudioRelease = (release: MbRelease): boolean =>
  release.status === "Official" && (release["release-group"]?.["secondary-types"]?.length ?? 0) === 0;

const byReleaseDate = (a: MbRelease, b: MbRelease): number => (a.date || UNDATED).localeCompare(b.date || UNDATED);

function pickAlbumRelease(releases: readonly MbRelease[]): MbRelease | null {
  const candidates = releases.filter(isOfficialStudioRelease).toSorted(byReleaseDate);
  return candidates.find((release) => release["release-group"]?.["primary-type"] === "Album") ?? candidates[0] ?? null;
}

function pickDisplayRelease(releases: readonly MbRelease[]): MbRelease | null {
  const official = releases.filter((release) => release.status === "Official");
  return pickAlbumRelease(releases) ?? official.toSorted(byReleaseDate)[0] ?? releases[0] ?? null;
}

// -- Songwriters --------------------------------------------------------------

function songwritersOf(recording: MbRecording): string[] {
  const namesByArtistId = new Map<string, string>();
  for (const relation of recording.relations ?? []) {
    for (const workRelation of relation.work?.relations ?? []) {
      const { artist } = workRelation;
      if (workRelation["target-type"] !== "artist" || !SONGWRITER_TYPES.has(workRelation.type) || !artist) continue;
      if (!namesByArtistId.has(artist.id)) namesByArtistId.set(artist.id, workRelation["target-credit"] || artist.name);
    }
  }
  return [...namesByArtistId.values()];
}

// -- Details ------------------------------------------------------------------

function songDetailsFrom(recording: MbRecording): SongDetails {
  const releases = recording.releases ?? [];
  const album = pickAlbumRelease(releases);
  const shownRelease = album ?? pickDisplayRelease(releases);
  return {
    recordingId: recording.id,
    title: recording.title,
    album: album?.title ?? null,
    releaseTitle: shownRelease?.title ?? null,
    isrc: recording.isrcs?.[0] ?? null,
    isrcs: recording.isrcs ?? [],
    artists: (recording["artist-credit"] ?? []).map((credit) => credit.name),
    songwriters: songwritersOf(recording),
    coverReleaseGroupId: shownRelease?.["release-group"]?.id ?? null,
    releaseYear: shownRelease?.date?.slice(0, 4) || null,
    lengthSec: recording.length ? recording.length / 1000 : null,
  };
}

// -- Exports ------------------------------------------------------------------

export { pickAlbumRelease, pickDisplayRelease, songDetailsFrom };
export type { SongDetails };

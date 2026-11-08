import { namedArtists } from "@/domain/project/display-title";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";

// -- Types ---------------------------------------------------------------------

interface SentLyric {
  id: number;
  videoId: string;
  song?: string;
  artist?: string;
}

interface LinkSuggestion {
  projectId: string;
  lyricId: string;
}

interface UnsureLink {
  lyricId: string;
  projectIds: string[];
}

interface LinkCandidates {
  sure: LinkSuggestion[];
  unsure: UnsureLink[];
}

// -- Derivations ---------------------------------------------------------------

const songKey = (song: string, artist: string): string =>
  `${song.trim().toLowerCase()}\n${artist.trim().toLowerCase()}`;

// A project without a video (a local audio file) can only be told apart by its song and artist.
function sentFor(project: ProjectIndexEntry, lyric: SentLyric): boolean {
  if (project.videoId) return project.videoId === lyric.videoId;
  return (
    lyric.song !== undefined &&
    songKey(project.title, namedArtists(project.artists).join(", ")) === songKey(lyric.song, lyric.artist ?? "")
  );
}

// Only one-to-one matches are sure; anything ambiguous needs a content check or the user's pick in Export.
function linkCandidates(entries: readonly ProjectIndexEntry[], lyrics: readonly SentLyric[]): LinkCandidates {
  const linkedLyricIds = new Set(entries.flatMap((entry) => entry.unisonLyricId ?? []));
  const projects = entries.filter((entry) => !entry.unisonLyricId && entry.lineCount > 0);
  const unlinkedLyrics = lyrics.filter((lyric) => !linkedLyricIds.has(String(lyric.id)));
  const candidates: LinkCandidates = { sure: [], unsure: [] };
  for (const lyric of unlinkedLyrics) {
    const matches = projects.filter((project) => sentFor(project, lyric));
    const lyricId = String(lyric.id);
    const [only] = matches;
    if (matches.length === 1 && unlinkedLyrics.filter((other) => sentFor(only, other)).length === 1) {
      candidates.sure.push({ projectId: only.id, lyricId });
    } else if (matches.length > 0) {
      candidates.unsure.push({ lyricId, projectIds: matches.map((project) => project.id) });
    }
  }
  return candidates;
}

// -- Exports -------------------------------------------------------------------

export type { LinkSuggestion, UnsureLink };
export { linkCandidates };

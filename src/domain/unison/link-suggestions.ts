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

// Only one-to-one matches are offered; anything ambiguous is left for the user to link from Export.
function linkSuggestions(entries: readonly ProjectIndexEntry[], lyrics: readonly SentLyric[]): LinkSuggestion[] {
  const linkedLyricIds = new Set(entries.flatMap((entry) => entry.unisonLyricId ?? []));
  const projects = entries.filter((entry) => !entry.unisonLyricId && entry.lineCount > 0);
  const unlinkedLyrics = lyrics.filter((lyric) => !linkedLyricIds.has(String(lyric.id)));
  return unlinkedLyrics.flatMap((lyric) => {
    const matches = projects.filter((project) => sentFor(project, lyric));
    if (matches.length !== 1) return [];
    const [project] = matches;
    const rivals = unlinkedLyrics.filter((other) => sentFor(project, other));
    return rivals.length === 1 ? [{ projectId: project.id, lyricId: String(lyric.id) }] : [];
  });
}

// -- Exports -------------------------------------------------------------------

export { linkSuggestions };
export type { LinkSuggestion };

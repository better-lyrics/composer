import type { ProjectIndexEntry } from "@/domain/project/index-entry";

// -- Derivations ---------------------------------------------------------------

function projectsByLyricId(entries: readonly ProjectIndexEntry[]): Map<string, ProjectIndexEntry> {
  return new Map(entries.flatMap((entry) => (entry.unisonLyricId ? [[entry.unisonLyricId, entry] as const] : [])));
}

// A lyric whose video already has a project is left out, so it is offered as a link instead of a copy.
function lyricsWithoutProject<T extends { id: number; videoId: string }>(
  lyrics: readonly T[],
  entries: readonly ProjectIndexEntry[],
): T[] {
  const linked = projectsByLyricId(entries);
  const videos = new Set(entries.flatMap((entry) => (entry.videoId ? [entry.videoId] : [])));
  return lyrics.filter((lyric) => !linked.has(String(lyric.id)) && !videos.has(lyric.videoId));
}

// -- Exports -------------------------------------------------------------------

export { lyricsWithoutProject, projectsByLyricId };

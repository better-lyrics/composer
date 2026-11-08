import type { ProjectIndexEntry } from "@/domain/project/index-entry";

// -- Derivations ---------------------------------------------------------------

function projectsByLyricId(entries: readonly ProjectIndexEntry[]): Map<string, ProjectIndexEntry> {
  return new Map(entries.flatMap((entry) => (entry.unisonLyricId ? [[entry.unisonLyricId, entry] as const] : [])));
}

function lyricsWithoutProject<T extends { id: number }>(
  lyrics: readonly T[],
  entries: readonly ProjectIndexEntry[],
): T[] {
  const linked = projectsByLyricId(entries);
  return lyrics.filter((lyric) => !linked.has(String(lyric.id)));
}

// -- Exports -------------------------------------------------------------------

export { lyricsWithoutProject, projectsByLyricId };

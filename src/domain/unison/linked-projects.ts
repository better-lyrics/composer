import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { isOwnLyric } from "@/domain/unison/ownership";

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

// One project carries the link, so a second copy of your own lyric opens unlinked.
function linksOnOpen(
  lyric: { id: number; submitter?: { keyId: string } },
  keyId: string | null,
  entries: readonly ProjectIndexEntry[],
): boolean {
  return isOwnLyric(lyric, keyId) && !projectsByLyricId(entries).has(String(lyric.id));
}

// -- Exports -------------------------------------------------------------------

export { linksOnOpen, lyricsWithoutProject, projectsByLyricId };

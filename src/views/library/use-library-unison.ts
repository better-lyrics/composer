import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { linkSuggestions } from "@/domain/unison/link-suggestions";
import { projectsByLyricId } from "@/domain/unison/linked-projects";
import { useLibraryUnisonLyrics } from "@/hooks/unison/useLibraryUnisonLyrics";
import { useUnisonFeatures } from "@/hooks/unison/useUnisonFeatures";
import { useUnisonSession } from "@/hooks/useUnisonSession";
import type { UnisonMineItem } from "@/lib/unison/api-types";
import type { LibraryUnison, UnisonMatch } from "@/views/library/project-row";
import { useMemo } from "react";

// -- Types ---------------------------------------------------------------------

interface LibraryUnisonData {
  showNotices: boolean;
  showWantedShelf: boolean;
  unison: LibraryUnison | null;
  items: readonly UnisonMineItem[] | null;
  projectByLyric: ReadonlyMap<string, ProjectIndexEntry>;
  matches: readonly UnisonMatch[];
}

// -- Hook ----------------------------------------------------------------------

function useLibraryUnison(entries: readonly ProjectIndexEntry[]): LibraryUnisonData {
  const session = useUnisonSession();
  const features = useUnisonFeatures();
  const projectByLyric = useMemo(() => projectsByLyricId(entries), [entries]);
  const linkedIds = useMemo(() => [...projectByLyric.keys()].toSorted(), [projectByLyric]);
  const signedIn = session !== null;
  const showColumn = signedIn && features.libraryColumn;
  const showNotices = signedIn && features.libraryNotices;
  const keyId = showColumn || showNotices ? (session?.keyId ?? null) : null;
  const seekingLinks = showColumn && entries.some((entry) => !entry.unisonLyricId && entry.lineCount > 0);
  const lyrics = useLibraryUnisonLyrics(keyId, linkedIds, seekingLinks);
  const items = lyrics?.items ?? null;
  const complete = lyrics?.complete ?? false;
  const matches = useMemo((): UnisonMatch[] => {
    if (!items || !complete) return [];
    const byId = new Map(items.map((item) => [String(item.id), item]));
    return linkSuggestions(entries, items).flatMap((suggestion) => {
      const lyric = byId.get(suggestion.lyricId);
      return lyric ? [{ ...suggestion, song: lyric.song, artist: lyric.artist }] : [];
    });
  }, [entries, items, complete]);
  const unison = useMemo(
    () => (showColumn ? { lyrics, matches: new Map(matches.map((match) => [match.projectId, match])) } : null),
    [showColumn, lyrics, matches],
  );
  return {
    showNotices,
    showWantedShelf: signedIn && features.wantedShelf,
    unison,
    items,
    projectByLyric,
    matches: showColumn ? matches : [],
  };
}

// -- Exports -------------------------------------------------------------------

export { useLibraryUnison };

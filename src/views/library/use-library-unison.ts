import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { projectsByLyricId } from "@/domain/unison/linked-projects";
import { useLibraryUnisonLyrics } from "@/hooks/unison/useLibraryUnisonLyrics";
import { useUnisonFeatures } from "@/hooks/unison/useUnisonFeatures";
import { useUnisonSession } from "@/hooks/useUnisonSession";
import type { UnisonMineItem } from "@/lib/unison/api-types";
import type { LibraryUnison } from "@/views/library/project-row";
import { useMemo } from "react";

// -- Types ---------------------------------------------------------------------

interface LibraryUnisonData {
  showNotices: boolean;
  showWantedShelf: boolean;
  unison: LibraryUnison | null;
  items: readonly UnisonMineItem[] | null;
  projectByLyric: ReadonlyMap<string, ProjectIndexEntry>;
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
  const lyrics = useLibraryUnisonLyrics(keyId, linkedIds);
  const unison = useMemo(() => (showColumn ? { lyrics } : null), [showColumn, lyrics]);
  return {
    showNotices,
    showWantedShelf: signedIn && features.wantedShelf,
    unison,
    items: lyrics?.items ?? null,
    projectByLyric,
  };
}

// -- Exports -------------------------------------------------------------------

export { useLibraryUnison };

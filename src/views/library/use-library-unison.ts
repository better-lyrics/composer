import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { projectsByLyricId } from "@/domain/unison/linked-projects";
import { useLibraryUnisonLyrics } from "@/hooks/unison/useLibraryUnisonLyrics";
import { useUnisonSession } from "@/hooks/useUnisonSession";
import type { UnisonMineItem } from "@/lib/unison/api-types";
import type { LibraryUnison } from "@/views/library/project-row";
import { useMemo } from "react";

// -- Types ---------------------------------------------------------------------

interface LibraryUnisonData {
  signedIn: boolean;
  unison: LibraryUnison | null;
  items: readonly UnisonMineItem[] | null;
  projectByLyric: ReadonlyMap<string, ProjectIndexEntry>;
}

// -- Hook ----------------------------------------------------------------------

function useLibraryUnison(entries: readonly ProjectIndexEntry[]): LibraryUnisonData {
  const session = useUnisonSession();
  const projectByLyric = useMemo(() => projectsByLyricId(entries), [entries]);
  const linkedIds = useMemo(() => [...projectByLyric.keys()].toSorted(), [projectByLyric]);
  const lyrics = useLibraryUnisonLyrics(session?.keyId ?? null, linkedIds);
  const signedIn = session !== null;
  const unison = useMemo(() => (signedIn ? { lyrics } : null), [signedIn, lyrics]);
  return { signedIn, unison, items: lyrics?.items ?? null, projectByLyric };
}

// -- Exports -------------------------------------------------------------------

export { useLibraryUnison };

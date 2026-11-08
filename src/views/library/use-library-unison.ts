import { useMemo } from "react";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import type { UnisonStanding } from "@/domain/unison/library-sort";
import { linkCandidates, type UnsureLink } from "@/domain/unison/link-suggestions";
import { projectsByLyricId } from "@/domain/unison/linked-projects";
import { useContentLinks } from "@/hooks/unison/useContentLinks";
import { useLibraryUnisonLyrics } from "@/hooks/unison/useLibraryUnisonLyrics";
import { useUnisonFeatures } from "@/hooks/unison/useUnisonFeatures";
import { useUnisonSession } from "@/hooks/useUnisonSession";
import type { UnisonMineItem } from "@/lib/unison/api-types";
import type { LibraryUnison, UnisonMatch } from "@/views/library/project-row";

// -- Types ---------------------------------------------------------------------

interface LibraryUnisonData {
  showNotices: boolean;
  showWantedShelf: boolean;
  unison: LibraryUnison | null;
  items: readonly UnisonMineItem[] | null;
  projectByLyric: ReadonlyMap<string, ProjectIndexEntry>;
  matches: readonly UnisonMatch[];
  linkedVideos: ReadonlyMap<string, string>;
  standings: ReadonlyMap<string, UnisonStanding>;
}

// -- Constants -----------------------------------------------------------------

const NOTHING_UNSURE: readonly UnsureLink[] = [];

// -- Hook ----------------------------------------------------------------------

// Unison sorts need a standing for every linked project, so they read every page past the usual cap.
function useLibraryUnison(entries: readonly ProjectIndexEntry[], sortsByUnison: boolean): LibraryUnisonData {
  const session = useUnisonSession();
  const features = useUnisonFeatures();
  const projectByLyric = useMemo(() => projectsByLyricId(entries), [entries]);
  const linkedIds = useMemo(() => [...projectByLyric.keys()].toSorted(), [projectByLyric]);
  const signedIn = session !== null;
  const showColumn = signedIn && features.libraryColumn;
  const showNotices = signedIn && features.libraryNotices;
  const keyId = showColumn || showNotices ? (session?.keyId ?? null) : null;
  const seekingLinks = showColumn && entries.some((entry) => !entry.unisonLyricId && entry.lineCount > 0);
  const lyrics = useLibraryUnisonLyrics(keyId, linkedIds, seekingLinks, showColumn && sortsByUnison);
  const items = lyrics?.items ?? null;
  const complete = lyrics?.complete ?? false;
  const candidates = useMemo(
    () => (items && complete ? linkCandidates(entries, items) : null),
    [entries, items, complete],
  );
  const contentLinks = useContentLinks(candidates?.unsure ?? NOTHING_UNSURE, entries);
  const matches = useMemo((): UnisonMatch[] => {
    if (!items || !candidates) return [];
    const byId = new Map(items.map((item) => [String(item.id), item]));
    return [...candidates.sure, ...contentLinks].flatMap((suggestion) => {
      const lyric = byId.get(suggestion.lyricId);
      return lyric ? [{ ...suggestion, song: lyric.song, artist: lyric.artist }] : [];
    });
  }, [items, candidates, contentLinks]);
  const unison = useMemo(
    () => (showColumn ? { lyrics, matches: new Map(matches.map((match) => [match.projectId, match])) } : null),
    [showColumn, lyrics, matches],
  );
  const linkedVideos = useMemo(() => new Map((items ?? []).map((item) => [String(item.id), item.videoId])), [items]);
  const standings = useMemo(
    () =>
      new Map(
        entries.flatMap((entry) => {
          const item = entry.unisonLyricId ? lyrics?.byId.get(entry.unisonLyricId) : undefined;
          if (!item) return [];
          const standing: UnisonStanding = {
            score: item.score,
            voteCount: item.voteCount,
            changedAt: item.revision.updatedAt,
            sentAt: item.createdAt,
          };
          return [[entry.id, standing] as const];
        }),
      ),
    [entries, lyrics],
  );
  return {
    linkedVideos,
    standings,
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

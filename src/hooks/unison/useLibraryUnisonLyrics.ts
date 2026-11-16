import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { isOwnLyric } from "@/domain/unison/ownership";
import { UNISON_STALE_TIME_MS, unisonQueryKeys } from "@/hooks/unison/query-keys";
import { fetchUnisonLyric } from "@/hooks/unison/useUnisonLyric";
import type { UnisonLyric, UnisonMineItem } from "@/lib/unison/api-types";
import { isUnisonNotFound } from "@/lib/unison/client";
import { fetchMinePages } from "@/lib/unison/endpoints";

// -- Types ---------------------------------------------------------------------

type LibraryLyric = Pick<
  UnisonMineItem,
  "id" | "videoId" | "score" | "voteCount" | "hidden" | "marks" | "revision" | "createdAt"
>;

type LinkedLookup = { found: "own"; lyric: LibraryLyric } | { found: "suggestion" | "removed" | "unresolved" };

interface LibraryUnisonLyrics {
  items: UnisonMineItem[];
  readById: LibraryLyric[];
  /** True once every page of `/lyrics/mine` loaded, so a linked id that is still missing was removed or is not ours. */
  complete: boolean;
  suggestionIds: ReadonlySet<string>;
  unresolvedIds: ReadonlySet<string>;
}

interface LibraryUnisonState extends LibraryUnisonLyrics {
  byId: ReadonlyMap<string, LibraryLyric>;
}

// -- Constants -----------------------------------------------------------------

const NO_IDS: ReadonlySet<string> = new Set();

// -- Fetching ------------------------------------------------------------------

function linkedLookup(result: PromiseSettledResult<UnisonLyric>, keyId: string | null): LinkedLookup {
  if (result.status === "rejected") return { found: isUnisonNotFound(result.reason) ? "removed" : "unresolved" };
  const lyric = result.value;
  if (!isOwnLyric(lyric, keyId)) return { found: "suggestion" };
  const { createdAt } = lyric;
  return createdAt === undefined ? { found: "unresolved" } : { found: "own", lyric: { ...lyric, createdAt } };
}

async function lookUpLinked(
  queryClient: QueryClient,
  ids: readonly string[],
  keyId: string | null,
): Promise<Map<string, LinkedLookup>> {
  const results = await Promise.allSettled(ids.map((id) => fetchUnisonLyric(queryClient, Number(id))));
  return new Map(ids.map((id, index) => [id, linkedLookup(results[index], keyId)]));
}

function idsWhere(lookups: ReadonlyMap<string, LinkedLookup>, wanted: LinkedLookup["found"]): Set<string> {
  return new Set([...lookups].flatMap(([id, lookup]) => (lookup.found === wanted ? [id] : [])));
}

async function fetchMineForLibrary(
  queryClient: QueryClient,
  linkedIds: readonly string[],
  loadAll: boolean,
  everyPage: boolean,
  signal: AbortSignal,
  keyId: string | null,
): Promise<LibraryUnisonLyrics> {
  const missing = new Set(linkedIds);
  const { items, complete } = await fetchMinePages(signal, {
    maxPages: everyPage ? Number.POSITIVE_INFINITY : loadAll ? undefined : 1,
    stopAfter: (page) => {
      for (const item of page) missing.delete(String(item.id));
      return missing.size === 0 && !loadAll;
    },
  });
  for (const item of items) missing.delete(String(item.id));
  const lookups = await lookUpLinked(queryClient, [...missing], keyId);
  return {
    items,
    readById: [...lookups.values()].flatMap((lookup) => (lookup.found === "own" ? [lookup.lyric] : [])),
    complete,
    suggestionIds: idsWhere(lookups, "suggestion"),
    unresolvedIds: complete ? idsWhere(lookups, "unresolved") : NO_IDS,
  };
}

// -- Hook ----------------------------------------------------------------------

function useLibraryUnisonLyrics(
  keyId: string | null,
  linkedIds: readonly string[],
  loadAll: boolean,
  everyPage: boolean,
): LibraryUnisonState | null {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: unisonQueryKeys.mineForLibrary(keyId ?? "", linkedIds, loadAll, everyPage),
    queryFn: ({ signal }) => fetchMineForLibrary(queryClient, linkedIds, loadAll, everyPage, signal, keyId),
    staleTime: UNISON_STALE_TIME_MS,
    // Another account's list must never stand in for this one.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[2] === keyId ? previous : undefined),
    enabled: keyId !== null,
  });
  const { data: lyrics, isPlaceholderData } = query;
  // Placeholder data answers for other linked ids, so it can never prove a lyric was removed.
  return useMemo(
    () =>
      lyrics
        ? {
            ...lyrics,
            complete: lyrics.complete && !isPlaceholderData,
            byId: new Map([...lyrics.items, ...lyrics.readById].map((lyric) => [String(lyric.id), lyric])),
          }
        : null,
    [lyrics, isPlaceholderData],
  );
}

// -- Exports -------------------------------------------------------------------

export { fetchMineForLibrary, useLibraryUnisonLyrics };

import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { isOwnLyric } from "@/domain/unison/ownership";
import { UNISON_STALE_TIME_MS, unisonQueryKeys } from "@/hooks/unison/query-keys";
import { fetchUnisonLyric } from "@/hooks/unison/useUnisonLyric";
import type { UnisonMineItem } from "@/lib/unison/api-types";
import { isUnisonNotFound } from "@/lib/unison/client";
import { fetchMinePages } from "@/lib/unison/endpoints";

// -- Types ---------------------------------------------------------------------

type LinkedLookup = "suggestion" | "own" | "removed" | "unresolved";

interface LibraryUnisonLyrics {
  items: UnisonMineItem[];
  /** True once every page of `/lyrics/mine` loaded, so a linked id that is still missing was removed or is not ours. */
  complete: boolean;
  suggestionIds: ReadonlySet<string>;
  unresolvedIds: ReadonlySet<string>;
}

interface LibraryUnisonState extends LibraryUnisonLyrics {
  byId: ReadonlyMap<string, UnisonMineItem>;
}

// -- Constants -----------------------------------------------------------------

const NO_IDS: ReadonlySet<string> = new Set();

// -- Fetching ------------------------------------------------------------------

async function lookUpLinked(
  queryClient: QueryClient,
  ids: readonly string[],
  keyId: string | null,
): Promise<Map<string, LinkedLookup>> {
  const results = await Promise.allSettled(ids.map((id) => fetchUnisonLyric(queryClient, Number(id))));
  return new Map(
    ids.map((id, index): [string, LinkedLookup] => {
      const result = results[index];
      if (result.status === "fulfilled") return [id, isOwnLyric(result.value, keyId) ? "own" : "suggestion"];
      return [id, isUnisonNotFound(result.reason) ? "removed" : "unresolved"];
    }),
  );
}

function idsWhere(lookups: ReadonlyMap<string, LinkedLookup>, wanted: LinkedLookup): Set<string> {
  return new Set([...lookups].flatMap(([id, found]) => (found === wanted ? [id] : [])));
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
    maxPages: everyPage ? Number.POSITIVE_INFINITY : undefined,
    stopAfter: (page) => {
      for (const item of page) missing.delete(String(item.id));
      return missing.size === 0 && !loadAll;
    },
  });
  for (const item of items) missing.delete(String(item.id));
  const lookups = await lookUpLinked(queryClient, [...missing], keyId);
  const suggestionIds = idsWhere(lookups, "suggestion");
  return {
    items,
    complete,
    suggestionIds,
    unresolvedIds: complete
      ? new Set([...missing].filter((id) => !suggestionIds.has(id) && lookups.get(id) !== "removed"))
      : NO_IDS,
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
            byId: new Map(lyrics.items.map((item) => [String(item.id), item])),
          }
        : null,
    [lyrics, isPlaceholderData],
  );
}

// -- Exports -------------------------------------------------------------------

export { fetchMineForLibrary, useLibraryUnisonLyrics };

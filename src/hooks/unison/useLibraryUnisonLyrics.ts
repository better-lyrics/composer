import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { isOwnLyric } from "@/domain/unison/ownership";
import { UNISON_STALE_TIME_MS, unisonQueryKeys } from "@/hooks/unison/query-keys";
import type { UnisonMineItem } from "@/lib/unison/api-types";
import { isUnisonNotFound } from "@/lib/unison/client";
import { fetchLyric, fetchMinePages } from "@/lib/unison/endpoints";

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
  ids: readonly string[],
  keyId: string | null,
  signal: AbortSignal,
): Promise<Map<string, LinkedLookup>> {
  const results = await Promise.allSettled(ids.map((id) => fetchLyric(Number(id), { signal })));
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
  linkedIds: readonly string[],
  loadAll: boolean,
  everyPage: boolean,
  signal: AbortSignal,
  keyId: string | null,
): Promise<LibraryUnisonLyrics> {
  const missing = new Set(linkedIds);
  const lookups = new Map<string, LinkedLookup>();
  let lookedUp = false;
  const { items, complete } = await fetchMinePages(signal, {
    maxPages: everyPage ? Number.POSITIVE_INFINITY : undefined,
    stopAfter: async (page) => {
      for (const item of page) missing.delete(String(item.id));
      if (!lookedUp && missing.size > 0) {
        lookedUp = true;
        for (const [id, found] of await lookUpLinked([...missing], keyId, signal)) {
          lookups.set(id, found);
          if (found === "suggestion") missing.delete(id);
        }
      }
      return missing.size === 0 && !loadAll;
    },
  });
  for (const item of items) missing.delete(String(item.id));
  if (complete) {
    const unchecked = [...missing].filter((id) => !lookups.has(id));
    for (const [id, found] of await lookUpLinked(unchecked, keyId, signal)) lookups.set(id, found);
  }
  return {
    items,
    complete,
    suggestionIds: idsWhere(lookups, "suggestion"),
    unresolvedIds: complete ? new Set([...missing].filter((id) => lookups.get(id) !== "removed")) : NO_IDS,
  };
}

// -- Hook ----------------------------------------------------------------------

function useLibraryUnisonLyrics(
  keyId: string | null,
  linkedIds: readonly string[],
  loadAll: boolean,
  everyPage: boolean,
): LibraryUnisonState | null {
  const query = useQuery({
    queryKey: unisonQueryKeys.mineForLibrary(keyId ?? "", linkedIds, loadAll, everyPage),
    queryFn: ({ signal }) => fetchMineForLibrary(linkedIds, loadAll, everyPage, signal, keyId),
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

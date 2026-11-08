import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { UNISON_STALE_TIME_MS, unisonQueryKeys } from "@/hooks/unison/query-keys";
import type { UnisonMineItem } from "@/lib/unison/api-types";
import { isUnisonNotFound } from "@/lib/unison/client";
import { fetchLyric, fetchMinePages } from "@/lib/unison/endpoints";

// -- Types ---------------------------------------------------------------------

interface LibraryUnisonLyrics {
  items: UnisonMineItem[];
  /** True once every page of `/lyrics/mine` loaded, so a linked id that is still missing was removed or is not ours. */
  complete: boolean;
  otherAccountIds: ReadonlySet<string>;
  unresolvedIds: ReadonlySet<string>;
}

interface LibraryUnisonState extends LibraryUnisonLyrics {
  byId: ReadonlyMap<string, UnisonMineItem>;
}

// -- Constants -----------------------------------------------------------------

const NO_IDS: ReadonlySet<string> = new Set();

// -- Fetching ------------------------------------------------------------------

// Past the page cap, unresolved links read as unknown instead of removed.
// Link suggestions need every lyric, since one on a later page can make a match ambiguous.
async function fetchMineForLibrary(
  linkedIds: readonly string[],
  loadAll: boolean,
  signal: AbortSignal,
): Promise<LibraryUnisonLyrics> {
  const missing = new Set(linkedIds);
  const { items, complete } = await fetchMinePages(signal, {
    stopAfter: (page) => {
      for (const item of page) missing.delete(String(item.id));
      return missing.size === 0 && !loadAll;
    },
  });
  if (complete) return { items, complete, ...(await lookUpMissing(missing, signal)) };
  return { items, complete, otherAccountIds: NO_IDS, unresolvedIds: NO_IDS };
}

// A linked lyric missing from a complete `/lyrics/mine` was removed (404) or belongs to another account.
async function lookUpMissing(
  missing: ReadonlySet<string>,
  signal: AbortSignal,
): Promise<Pick<LibraryUnisonLyrics, "otherAccountIds" | "unresolvedIds">> {
  const ids = [...missing];
  const results = await Promise.allSettled(ids.map((id) => fetchLyric(Number(id), { signal })));
  const otherAccountIds = new Set<string>();
  const unresolvedIds = new Set<string>();
  results.forEach((result, index) => {
    if (result.status === "fulfilled") otherAccountIds.add(ids[index]);
    else if (!isUnisonNotFound(result.reason)) unresolvedIds.add(ids[index]);
  });
  return { otherAccountIds, unresolvedIds };
}

// -- Hook ----------------------------------------------------------------------

function useLibraryUnisonLyrics(
  keyId: string | null,
  linkedIds: readonly string[],
  loadAll: boolean,
): LibraryUnisonState | null {
  const query = useQuery({
    queryKey: unisonQueryKeys.mineForLibrary(keyId ?? "", linkedIds, loadAll),
    queryFn: ({ signal }) => fetchMineForLibrary(linkedIds, loadAll, signal),
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

export { useLibraryUnisonLyrics };

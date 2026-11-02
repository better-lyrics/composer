import { UNISON_STALE_TIME_MS, unisonQueryKeys } from "@/hooks/unison/query-keys";
import type { UnisonMineItem } from "@/lib/unison/api-types";
import { fetchMine } from "@/lib/unison/endpoints";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

// -- Types ---------------------------------------------------------------------

interface LibraryUnisonLyrics {
  items: UnisonMineItem[];
  /** True once every page of `/lyrics/mine` loaded, so a linked id that is still missing was removed. */
  complete: boolean;
}

interface LibraryUnisonState extends LibraryUnisonLyrics {
  byId: ReadonlyMap<string, UnisonMineItem>;
}

// -- Constants -----------------------------------------------------------------

const MINE_PAGE_LIMIT = 50;
// 6 pages of 50 cover 300 lyrics; past that, unresolved links read as unknown instead of removed.
const MAX_MINE_PAGES = 6;

// -- Fetching ------------------------------------------------------------------

async function fetchMineForLibrary(linkedIds: readonly string[], signal: AbortSignal): Promise<LibraryUnisonLyrics> {
  const missing = new Set(linkedIds);
  const items: UnisonMineItem[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_MINE_PAGES; page++) {
    const result = await fetchMine({ cursor, limit: MINE_PAGE_LIMIT, signal });
    items.push(...result.items);
    for (const item of result.items) missing.delete(String(item.id));
    if (result.nextCursor === null) return { items, complete: true };
    if (missing.size === 0) return { items, complete: false };
    cursor = result.nextCursor;
  }
  return { items, complete: false };
}

// -- Hook ----------------------------------------------------------------------

function useLibraryUnisonLyrics(keyId: string | null, linkedIds: readonly string[]): LibraryUnisonState | null {
  const query = useQuery({
    queryKey: unisonQueryKeys.mineForLibrary(keyId ?? "", linkedIds),
    queryFn: ({ signal }) => fetchMineForLibrary(linkedIds, signal),
    staleTime: UNISON_STALE_TIME_MS,
    placeholderData: keepPreviousData,
    enabled: keyId !== null,
  });
  const { data } = query;
  return useMemo(
    () => (data ? { ...data, byId: new Map(data.items.map((item) => [String(item.id), item])) } : null),
    [data],
  );
}

// -- Exports -------------------------------------------------------------------

export { useLibraryUnisonLyrics };

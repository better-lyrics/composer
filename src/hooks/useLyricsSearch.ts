import { useQueries } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { LyricsSearchResult, ProviderName } from "@/domain/lyrics-search/result";
import { getProviders } from "@/utils/lyrics-search/registry";
import { LyricsSearchError, type LyricsSearchQuery } from "@/utils/lyrics-search/types";

// -- Constants ----------------------------------------------------------------

const DEFAULT_DEBOUNCE_MS = 350;

// -- Types --------------------------------------------------------------------

interface UseLyricsSearchOptions {
  enabled?: boolean;
  debounceMs?: number;
}

interface UseLyricsSearchResult {
  results: LyricsSearchResult[];
  isFetching: boolean;
  errors: Map<ProviderName, LyricsSearchError>;
}

// -- Helpers ------------------------------------------------------------------

function isQueryEmpty(query: LyricsSearchQuery): boolean {
  return !query.track && !query.videoId && !query.isrc;
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  const latestValueRef = useRef(value);
  latestValueRef.current = value;

  useEffect(() => {
    if (delay <= 0) {
      setDebounced(value);
      return;
    }
    const timer = setTimeout(() => {
      setDebounced(latestValueRef.current);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function toLyricsSearchError(provider: ProviderName, raw: unknown): LyricsSearchError {
  if (raw instanceof LyricsSearchError) return raw;
  const message = raw instanceof Error ? raw.message : String(raw);
  return new LyricsSearchError(provider, message, raw);
}

// -- Hook ---------------------------------------------------------------------

function useLyricsSearch(query: LyricsSearchQuery, options?: UseLyricsSearchOptions): UseLyricsSearchResult {
  const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const enabled = options?.enabled ?? true;
  const debouncedQuery = useDebouncedValue(query, debounceMs);

  const providers = getProviders();
  const queryEmpty = isQueryEmpty(debouncedQuery);

  const queryConfigs = providers.map((provider) => ({
    queryKey: ["lyrics-search", provider.name, debouncedQuery] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) => provider.search(debouncedQuery, signal),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    enabled: enabled && !queryEmpty && provider.canSearch(debouncedQuery),
    retry: false,
  }));

  const queryResults = useQueries({ queries: queryConfigs });

  if (queryEmpty) {
    return { results: [], isFetching: false, errors: new Map<ProviderName, LyricsSearchError>() };
  }

  const seenIds = new Set<string>();
  const merged: LyricsSearchResult[] = [];
  const errors = new Map<ProviderName, LyricsSearchError>();
  let isFetching = false;

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const result = queryResults[i];
    if (!result) continue;

    if (result.isFetching) isFetching = true;
    if (result.error) {
      errors.set(provider.name, toLyricsSearchError(provider.name, result.error));
    }
    const data = result.data;
    if (!data) continue;

    for (const item of data) {
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      merged.push(item);
    }
  }

  return { results: merged, isFetching, errors };
}

// -- Exports ------------------------------------------------------------------

export { DEFAULT_DEBOUNCE_MS, useLyricsSearch };
export type { UseLyricsSearchOptions, UseLyricsSearchResult };

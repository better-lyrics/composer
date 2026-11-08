import { canonicalJson } from "@/domain/unison/canonical-json";
import { UNISON_STALE_TIME_MS, unisonQueryKeys } from "@/hooks/unison/query-keys";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { compareWithLive, previewRevision } from "@/lib/unison/endpoints";
import type { RevisionInput } from "@/lib/unison/revision-types";
import { fnv1a } from "@/utils/fnv1a";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

// -- Constants -----------------------------------------------------------------

// Typing in the TTML editor changes the export on every key; Unison throttles previews.
const PREVIEW_DEBOUNCE_MS = 600;

// -- Hook ----------------------------------------------------------------------

function useRevisionPreview(lyricId: number, input: RevisionInput, onError: (error: unknown) => void) {
  const settledInput = useDebouncedValue(input, PREVIEW_DEBOUNCE_MS);
  const inputHash = useMemo(() => fnv1a(canonicalJson(settledInput)).toString(36), [settledInput]);
  const sameAsLive = useQuery({
    queryKey: unisonQueryKeys.revisionSameAsLive(lyricId, inputHash),
    queryFn: ({ signal }) => compareWithLive(lyricId, settledInput, { signal }),
    staleTime: UNISON_STALE_TIME_MS,
    gcTime: 0,
    retry: false,
  });
  // A failed check falls back to the full preview, which reports its own errors.
  const changed = sameAsLive.data === false || sameAsLive.isError;
  const query = useQuery({
    queryKey: unisonQueryKeys.revisionPreview(lyricId, inputHash),
    queryFn: async ({ signal }) => {
      try {
        return await previewRevision(lyricId, settledInput, { signal });
      } catch (error) {
        onError(error);
        throw error;
      }
    },
    enabled: changed,
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[2] === lyricId ? previous : undefined),
    staleTime: UNISON_STALE_TIME_MS,
    gcTime: 0,
    retry: false,
  });
  const upToDate = sameAsLive.data === true;
  return {
    query,
    upToDate,
    settling: settledInput !== input || sameAsLive.isPending || (changed && query.isPlaceholderData),
  };
}

// -- Exports -------------------------------------------------------------------

export { useRevisionPreview };

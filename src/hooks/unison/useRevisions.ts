import { UNISON_STALE_TIME_MS, unisonQueryKeys } from "@/hooks/unison/query-keys";
import { fetchRevision, fetchRevisionDiff, fetchRevisions } from "@/lib/unison/endpoints";
import type { RevisionDetail } from "@/lib/unison/revision-types";
import { type QueryClient, useQuery } from "@tanstack/react-query";

// -- Hooks ---------------------------------------------------------------------

function useRevisions(lyricId: number) {
  return useQuery({
    queryKey: unisonQueryKeys.revisions(lyricId),
    queryFn: ({ signal }) => fetchRevisions(lyricId, { signal }),
    staleTime: UNISON_STALE_TIME_MS,
  });
}

// A revision never changes after it is saved, so a diff between two revisions never goes stale.
function useRevisionDiff(lyricId: number, revId: number, againstRevId: number | null) {
  return useQuery({
    queryKey: unisonQueryKeys.revisionDiff(lyricId, revId, againstRevId),
    queryFn: ({ signal }) => fetchRevisionDiff(lyricId, revId, againstRevId, { signal }),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

// -- Fetches -------------------------------------------------------------------

function fetchRevisionContent(queryClient: QueryClient, lyricId: number, revId: number): Promise<RevisionDetail> {
  return queryClient.fetchQuery({
    queryKey: unisonQueryKeys.revision(lyricId, revId),
    queryFn: ({ signal }) => fetchRevision(lyricId, revId, { signal }),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

// -- Exports -------------------------------------------------------------------

export { fetchRevisionContent, useRevisionDiff, useRevisions };

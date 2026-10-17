import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { useHiddenProjectIds } from "@/hooks/useHiddenProjectIds";
import { subscribeProjectsDeleted } from "@/lib/project-channel";
import { subscribeProjectIndexChanges } from "@/lib/project-index-changes";
import { listProjectIndex } from "@/lib/project-repository";
import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

// -- Types --------------------------------------------------------------------

interface ProjectIndexState {
  entries: ProjectIndexEntry[] | undefined;
  stored: ProjectIndexEntry[] | undefined;
  error: Error | null;
  fetchedAt: number;
  fresh: boolean;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[ProjectIndex]";
const PROJECT_INDEX_QUERY_KEY = ["project-index"] as const;

// -- Query bridge: one index subscription per QueryClient ----------------------

interface IndexBridge {
  refCount: number;
  stop: () => void;
}

const bridges = new Map<QueryClient, IndexBridge>();

function acquireIndexBridge(queryClient: QueryClient): () => void {
  const existing = bridges.get(queryClient);
  if (existing) {
    existing.refCount += 1;
  } else {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: PROJECT_INDEX_QUERY_KEY });
    };
    const stopLocal = subscribeProjectIndexChanges(refresh);
    const stopRemote = subscribeProjectsDeleted(refresh);
    bridges.set(queryClient, {
      refCount: 1,
      stop: () => {
        stopLocal();
        stopRemote();
      },
    });
  }
  return () => releaseIndexBridge(queryClient);
}

function releaseIndexBridge(queryClient: QueryClient): void {
  const bridge = bridges.get(queryClient);
  if (!bridge) return;
  bridge.refCount -= 1;
  if (bridge.refCount <= 0) {
    bridge.stop();
    bridges.delete(queryClient);
  }
}

// -- Hook ---------------------------------------------------------------------

function useProjectIndex(): ProjectIndexState {
  const queryClient = useQueryClient();
  const { data, error, dataUpdatedAt, isFetchedAfterMount } = useQuery({
    queryKey: PROJECT_INDEX_QUERY_KEY,
    queryFn: listProjectIndex,
    staleTime: 0,
    gcTime: Number.POSITIVE_INFINITY,
  });
  const hidden = useHiddenProjectIds();
  const entries = useMemo(
    () => (data && hidden.size > 0 ? data.filter((entry) => !hidden.has(entry.id)) : data),
    [data, hidden],
  );

  useEffect(() => {
    if (error) console.error(LOG_PREFIX, "could not load the project index", error);
  }, [error]);

  useEffect(() => acquireIndexBridge(queryClient), [queryClient]);

  return { entries, stored: data, error, fetchedAt: dataUpdatedAt, fresh: isFetchedAfterMount };
}

// -- Exports ------------------------------------------------------------------

export { useProjectIndex };

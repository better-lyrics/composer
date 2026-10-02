import { subscribeProjectIndexChanges } from "@/lib/project-index-changes";
import { type StorageReport, readStorageReport } from "@/lib/storage-report";
import { subscribeStorageSignals } from "@/lib/storage-signals";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[StorageReport]";
const STORAGE_REPORT_QUERY_KEY = ["storage-report"] as const;

// -- Hook ---------------------------------------------------------------------

function useStorageReport(): StorageReport | undefined {
  const queryClient = useQueryClient();
  const { data, error } = useQuery({
    queryKey: STORAGE_REPORT_QUERY_KEY,
    queryFn: readStorageReport,
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    if (error) console.error(LOG_PREFIX, "could not read storage usage", error);
  }, [error]);

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: STORAGE_REPORT_QUERY_KEY });
    };
    const stopIndex = subscribeProjectIndexChanges(refresh);
    const stopSignals = subscribeStorageSignals(refresh);
    return () => {
      stopIndex();
      stopSignals();
    };
  }, [queryClient]);

  return data;
}

// -- Exports ------------------------------------------------------------------

export { useStorageReport };

import { useUnisonLyric } from "@/hooks/unison/useUnisonLyric";
import { type UnisonStatus, unisonStatus } from "@/domain/unison/lyric-status";
import type { UnisonLyric } from "@/lib/unison/api-types";
import { isUnisonNotFound } from "@/lib/unison/client";

// -- Types ---------------------------------------------------------------------

type LinkedLyric =
  | { kind: "loading" }
  | { kind: "failed"; error: Error; retry: () => void }
  | { kind: "removed" }
  | { kind: "found"; lyric: UnisonLyric; status: UnisonStatus };

// -- Constants -----------------------------------------------------------------

// -- Hook ----------------------------------------------------------------------

function useLinkedLyric(unisonLyricId: string): LinkedLyric {
  const query = useUnisonLyric(Number(unisonLyricId));
  if (isUnisonNotFound(query.error)) return { kind: "removed" };
  if (query.data) return { kind: "found", lyric: query.data, status: unisonStatus(query.data) };
  if (query.error) return { kind: "failed", error: query.error, retry: () => void query.refetch() };
  return { kind: "loading" };
}

// -- Exports -------------------------------------------------------------------

export { useLinkedLyric };

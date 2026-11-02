import { useUnisonLyric } from "@/hooks/unison/useUnisonLyric";
import { type UnisonStatus, unisonStatus } from "@/domain/unison/lyric-status";
import type { UnisonLyric } from "@/lib/unison/api-types";
import { UnisonError } from "@/lib/unison/client";

// -- Types ---------------------------------------------------------------------

type LinkedLyric =
  | { kind: "loading" }
  | { kind: "failed"; error: Error; retry: () => void }
  | { kind: "removed" }
  | { kind: "found"; lyric: UnisonLyric; status: UnisonStatus };

// -- Constants -----------------------------------------------------------------

const NOT_FOUND_STATUS = 404;

// -- Hook ----------------------------------------------------------------------

function useLinkedLyric(unisonLyricId: string): LinkedLyric {
  const query = useUnisonLyric(Number(unisonLyricId));
  if (query.data) return { kind: "found", lyric: query.data, status: unisonStatus(query.data) };
  if (query.error instanceof UnisonError && query.error.status === NOT_FOUND_STATUS) return { kind: "removed" };
  if (query.error) return { kind: "failed", error: query.error, retry: () => void query.refetch() };
  return { kind: "loading" };
}

// -- Exports -------------------------------------------------------------------

export { useLinkedLyric };
export type { LinkedLyric };

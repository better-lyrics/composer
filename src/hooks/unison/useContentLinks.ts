import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import type { LinkSuggestion, UnsureLink } from "@/domain/unison/link-suggestions";
import { UNISON_STALE_TIME_MS, unisonQueryKeys } from "@/hooks/unison/query-keys";
import { fetchUnisonLyric } from "@/hooks/unison/useUnisonLyric";
import { linksByContent } from "@/lib/unison/live-lyric-match";

// -- Constants -----------------------------------------------------------------

const NO_LINKS: readonly LinkSuggestion[] = [];

// -- Hook ----------------------------------------------------------------------

// Keyed on each candidate's last save, so an edit compares again.
function useContentLinks(
  unsure: readonly UnsureLink[],
  entries: readonly ProjectIndexEntry[],
): readonly LinkSuggestion[] {
  const queryClient = useQueryClient();
  const savedAt = new Map(entries.map((entry) => [entry.id, entry.updatedAt]));
  const candidates = unsure.map(({ lyricId, projectIds }) => [
    lyricId,
    ...projectIds.map((id) => `${id}@${savedAt.get(id) ?? 0}`),
  ]);
  const { data } = useQuery({
    queryKey: unisonQueryKeys.contentLinks(candidates),
    queryFn: () => linksByContent(unsure, entries, (lyricId) => fetchUnisonLyric(queryClient, Number(lyricId))),
    enabled: unsure.length > 0,
    staleTime: UNISON_STALE_TIME_MS,
  });
  return data?.links ?? NO_LINKS;
}

// -- Exports -------------------------------------------------------------------

export { useContentLinks };

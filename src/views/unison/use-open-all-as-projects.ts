import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchUnisonLyric } from "@/hooks/unison/useUnisonLyric";
import { deleteProject } from "@/lib/open-project";
import type { UnisonMineItem } from "@/lib/unison/api-types";
import { saveUnisonLyricProject } from "@/lib/unison/save-unison-projects";
import { showLyricsOpenedAsProjectsToast, showUnisonFailureToast } from "@/utils/unison-toast";

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonOpenAll]";

// -- Hook ----------------------------------------------------------------------

function useOpenAllAsProjects() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const openAll = async (items: readonly UnisonMineItem[]) => {
    if (busy) return;
    setBusy(true);
    let results: PromiseSettledResult<string | null>[];
    try {
      results = await Promise.allSettled(
        items.map(async (item) => saveUnisonLyricProject(await fetchUnisonLyric(queryClient, item.id))),
      );
    } finally {
      setBusy(false);
    }
    const created = results.flatMap((result) => (result.status === "fulfilled" && result.value ? [result.value] : []));
    const failed = results.length - created.length;
    const rejected = results.filter((result) => result.status === "rejected");
    for (const result of rejected) console.error(LOG_PREFIX, "could not open a lyric as a project", result.reason);
    const lastError: unknown = rejected.at(-1)?.reason ?? null;
    if (created.length === 0) {
      showUnisonFailureToast("Could not open your lyrics as projects", lastError);
      return;
    }
    showLyricsOpenedAsProjectsToast(created.length, failed, () => {
      Promise.all(created.map(deleteProject)).catch((error: unknown) =>
        console.error(LOG_PREFIX, "could not remove the new projects", error),
      );
    });
  };

  return { busy, openAll };
}

// -- Exports -------------------------------------------------------------------

export { useOpenAllAsProjects };

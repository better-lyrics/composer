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
    const created: string[] = [];
    let failed = 0;
    let lastError: unknown = null;
    for (const item of items) {
      try {
        const id = await saveUnisonLyricProject(await fetchUnisonLyric(queryClient, item.id));
        if (id) created.push(id);
        else failed++;
      } catch (error) {
        console.error(LOG_PREFIX, `could not open lyric ${item.id} as a project`, error);
        failed++;
        lastError = error;
      }
    }
    setBusy(false);
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

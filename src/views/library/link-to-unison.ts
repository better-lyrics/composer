import type { LinkSuggestion } from "@/domain/unison/link-suggestions";
import { linkProjectsToLyrics, unlinkProjectsFromLyric } from "@/lib/unison/project-link";
import { showProjectsLinkedToast } from "@/utils/unison-toast";

// -- Actions -------------------------------------------------------------------

async function linkToUnison(links: readonly LinkSuggestion[]): Promise<void> {
  await linkProjectsToLyrics(links);
  showProjectsLinkedToast(links.length, () => {
    void Promise.all(links.map(({ lyricId }) => unlinkProjectsFromLyric(lyricId)));
  });
}

// -- Exports -------------------------------------------------------------------

export { linkToUnison };

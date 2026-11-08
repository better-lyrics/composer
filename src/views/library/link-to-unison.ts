import type { LinkSuggestion } from "@/domain/unison/link-suggestions";
import { linkProjectsToLyrics, unlinkProjectsFromLyric } from "@/lib/unison/project-link";
import { showLinkFailedToast, showProjectsLinkedToast } from "@/utils/unison-toast";

// -- Actions -------------------------------------------------------------------

async function linkToUnison(links: readonly LinkSuggestion[]): Promise<void> {
  const linked = await linkProjectsToLyrics(links);
  if (linked.length < links.length) showLinkFailedToast(links.length - linked.length);
  if (linked.length === 0) return;
  showProjectsLinkedToast(linked.length, () => {
    void Promise.all(linked.map(({ lyricId }) => unlinkProjectsFromLyric(lyricId)));
  });
}

// -- Exports -------------------------------------------------------------------

export { linkToUnison };

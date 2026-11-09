import { quotedTitle } from "@/domain/project/display-title";
import type { SuggestedVideo } from "@/lib/unison/api-types";
import type { useConfirm } from "@/stores/confirm-store";

// -- Functions -----------------------------------------------------------------

async function confirmDifferentTitle(
  confirm: ReturnType<typeof useConfirm>,
  suggestion: SuggestedVideo,
  songTitle: string,
): Promise<boolean> {
  if (suggestion.match?.level === "same") return true;
  return confirm({
    title: "Link a video with a different title?",
    description: `${quotedTitle(suggestion.title)} may not be the same recording as ${quotedTitle(songTitle)}. Link it only if the lyrics line up with it.`,
    confirmLabel: "Link video",
    cancelLabel: "Cancel",
    variant: "primary",
  });
}

// -- Exports -------------------------------------------------------------------

export { confirmDifferentTitle };

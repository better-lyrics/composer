import { quotedTitle } from "@/domain/project/display-title";
import type { SuggestedVideo } from "@/lib/unison/api-types";
import type { useConfirm } from "@/stores/confirm-store";

// -- Functions -----------------------------------------------------------------

function uncertainMatchReason(suggestion: SuggestedVideo): string {
  const title = quotedTitle(suggestion.title);
  if (suggestion.match?.level === "related") return `${title} might be a different version of this song.`;
  if (suggestion.match?.level === "different") return `${title} looks like a different version, or another song.`;
  return `Unison hasn't checked whether ${title} matches this song.`;
}

async function confirmDifferentTitle(
  confirm: ReturnType<typeof useConfirm>,
  suggestion: SuggestedVideo,
): Promise<boolean> {
  if (suggestion.match?.level === "same") return true;
  return confirm({
    title: "Link a video with a different title?",
    description: `${uncertainMatchReason(suggestion)} Link it only if the lyrics line up with it.`,
    confirmLabel: "Link video",
    cancelLabel: "Cancel",
    variant: "primary",
  });
}

// -- Exports -------------------------------------------------------------------

export { confirmDifferentTitle };

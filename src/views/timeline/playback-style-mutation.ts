// -- Constants -----------------------------------------------------------------

const PROGRESS_FILL_DECLARATION = /--progress-fill:[^;]*;?\s*/;

// -- Functions -----------------------------------------------------------------

function withoutProgressFill(style: string | null): string {
  return (style ?? "").replace(PROGRESS_FILL_DECLARATION, "");
}

// Playback restyles pinned word labels and banner fills every frame; neither changes the scroll size.
function isPlaybackStyleWrite(mutation: MutationRecord): boolean {
  if (mutation.type !== "attributes" || mutation.attributeName !== "style") return false;
  const target = mutation.target as HTMLElement;
  if (target.parentElement?.hasAttribute("data-word-block")) return true;
  return (
    target.hasAttribute("data-instance-start") &&
    withoutProgressFill(mutation.oldValue) === withoutProgressFill(target.getAttribute("style"))
  );
}

// -- Exports -------------------------------------------------------------------

export { isPlaybackStyleWrite };

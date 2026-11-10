// -- Constants -----------------------------------------------------------------

const PROGRESS_FILL_DECLARATION = /--progress-fill:[^;]*;?\s*/;

// -- Functions -----------------------------------------------------------------

function withoutProgressFill(style: string | null): string {
  return (style ?? "").replace(PROGRESS_FILL_DECLARATION, "");
}

function declarationsOutside(style: string | null, playbackProperties: readonly string[]): string {
  return (style ?? "")
    .split(";")
    .map((declaration) => declaration.trim())
    .filter((declaration) => {
      if (declaration === "") return false;
      return !playbackProperties.includes(declaration.slice(0, declaration.indexOf(":")).trim());
    })
    .join(";");
}

// Elements list the properties playback writes every frame in data-playback-style; any other style change still counts.
function changesOnlyPlaybackProperties(target: HTMLElement, oldStyle: string | null): boolean {
  const playbackProperties = target.dataset.playbackStyle?.split(" ");
  if (!playbackProperties) return false;
  return (
    declarationsOutside(oldStyle, playbackProperties) ===
    declarationsOutside(target.getAttribute("style"), playbackProperties)
  );
}

// Playback restyles pinned word labels, banner fills and band layers every frame; none of them changes the scroll size.
function isPlaybackStyleWrite(mutation: MutationRecord): boolean {
  if (mutation.type !== "attributes" || mutation.attributeName !== "style") return false;
  const target = mutation.target as HTMLElement;
  if (target.parentElement?.hasAttribute("data-word-block")) return true;
  if (changesOnlyPlaybackProperties(target, mutation.oldValue)) return true;
  return (
    target.hasAttribute("data-instance-start") &&
    withoutProgressFill(mutation.oldValue) === withoutProgressFill(target.getAttribute("style"))
  );
}

// -- Exports -------------------------------------------------------------------

export { isPlaybackStyleWrite };

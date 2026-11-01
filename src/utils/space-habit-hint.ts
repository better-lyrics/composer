import type { ProjectTab } from "@/domain/project/tab";
import type { ShortcutPresetId } from "@/stores/shortcut-presets";

// -- Types --------------------------------------------------------------------

interface SpaceHintMoment {
  preset: ShortcutPresetId;
  playOverridden: boolean;
  answered: boolean;
  activeTab: ProjectTab;
  hasAudio: boolean;
  spaceDidNothing: boolean;
  spaceAt?: number;
  playAt?: number;
}

// -- Constants ----------------------------------------------------------------

const SPACE_HINT_WINDOW_MS = 2000;

// -- Helpers ------------------------------------------------------------------

// Space that does nothing, or Space followed soon by play on its own key, reads as someone who expects Space to play.
function shouldOfferSpaceHint(moment: SpaceHintMoment): boolean {
  const { preset, playOverridden, answered, activeTab, hasAudio, spaceDidNothing, spaceAt, playAt } = moment;
  if (preset !== "composer" || playOverridden || answered || activeTab === "sync" || !hasAudio) return false;
  if (spaceDidNothing) return true;
  if (spaceAt === undefined || playAt === undefined) return false;
  const gap = playAt - spaceAt;
  return gap >= 0 && gap <= SPACE_HINT_WINDOW_MS;
}

// -- Exports ------------------------------------------------------------------

export { shouldOfferSpaceHint };
export type { SpaceHintMoment };

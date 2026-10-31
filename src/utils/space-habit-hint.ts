import type { ProjectTab } from "@/domain/project/tab";
import type { ShortcutPresetId } from "@/stores/shortcut-presets";

// -- Types --------------------------------------------------------------------

interface SpaceHintMoment {
  preset: ShortcutPresetId;
  playOverridden: boolean;
  answered: boolean;
  activeTab: ProjectTab;
  hasAudio: boolean;
  spaceAt: number | undefined;
  playAt: number;
}

// -- Constants ----------------------------------------------------------------

const SPACE_HINT_WINDOW_MS = 2000;

// -- Helpers ------------------------------------------------------------------

// Space pressed outside Sync, then play by its own key soon after, reads as someone who expects Space to play.
function shouldOfferSpaceHint(moment: SpaceHintMoment) {
  const { preset, playOverridden, answered, activeTab, hasAudio, spaceAt, playAt } = moment;
  if (preset !== "composer" || playOverridden || answered || activeTab === "sync" || !hasAudio) return false;
  if (spaceAt === undefined) return false;
  const gap = playAt - spaceAt;
  return gap >= 0 && gap <= SPACE_HINT_WINDOW_MS;
}

// -- Exports ------------------------------------------------------------------

export type { SpaceHintMoment };
export { shouldOfferSpaceHint };

import type { CommandContext } from "@/domain/commands/command";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { getSplitCharacter } from "@/utils/split-character";
import { songEndOrUnbounded } from "@/utils/timing/song-end";

// -- Functions ----------------------------------------------------------------

function commandContext(): CommandContext {
  return {
    splitChar: getSplitCharacter(),
    shareTimingInNewGroups: useSettingsStore.getState().shareTimingInNewGroups,
    newId: () => crypto.randomUUID(),
    songEnd: songEndOrUnbounded(useAudioStore.getState().duration),
  };
}

// -- Exports ------------------------------------------------------------------

export { commandContext };

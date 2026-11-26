import type { CommandContext } from "@/domain/commands/command";
import { useSettingsStore } from "@/stores/settings";
import { getSplitCharacter } from "@/utils/split-character";

// -- Functions ----------------------------------------------------------------

function commandContext(): CommandContext {
  return {
    splitChar: getSplitCharacter(),
    shareTimingInNewGroups: useSettingsStore.getState().shareTimingInNewGroups,
    newId: () => crypto.randomUUID(),
  };
}

// -- Exports ------------------------------------------------------------------

export { commandContext };

import { useSettingsStore } from "@/stores/settings";
import { withoutSplitCharacter } from "insync/split-character-text";

// -- Functions ----------------------------------------------------------------

function getSplitCharacter(): string {
  return useSettingsStore.getState().splitCharacter;
}

function stripSplitCharacter(text: string): string {
  return withoutSplitCharacter(text, getSplitCharacter());
}

// -- Exports ------------------------------------------------------------------

export { getSplitCharacter, stripSplitCharacter };

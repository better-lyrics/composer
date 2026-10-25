import type { PitchLineMode } from "@/domain/pitch/pitch-line-mode";
import { useSettingsStore } from "@/stores/settings";

// -- State ---------------------------------------------------------------------

// Turning the line back on restores the mode it was turned off from, without a second setting.
let lastShownMode: Exclude<PitchLineMode, "off"> = "always";

// -- Functions -----------------------------------------------------------------

function setPitchLineShown(shown: boolean): void {
  const settings = useSettingsStore.getState();
  if (settings.pitchLine !== "off") lastShownMode = settings.pitchLine;
  settings.set("pitchLine", shown ? lastShownMode : "off");
}

function togglePitchLine(): void {
  setPitchLineShown(useSettingsStore.getState().pitchLine === "off");
}

// -- Exports -------------------------------------------------------------------

export { setPitchLineShown, togglePitchLine };

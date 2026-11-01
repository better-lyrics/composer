import type { PitchLineMode } from "@/domain/pitch/pitch-line-mode";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { toast } from "sonner";

// -- Constants -----------------------------------------------------------------

const NEEDS_VOCALS_TOAST_ID = "pitch-line-needs-vocals";

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
  const show = useSettingsStore.getState().pitchLine === "off";
  setPitchLineShown(show);
  if (show && !useSeparationStore.getState().stemUrls.vocals) {
    toast("The pitch line needs separated vocals", {
      id: NEEDS_VOCALS_TOAST_ID,
      description: "Separate vocals in the Stem menu and it appears in each word.",
    });
  }
}

// -- Exports -------------------------------------------------------------------

export { setPitchLineShown, togglePitchLine };

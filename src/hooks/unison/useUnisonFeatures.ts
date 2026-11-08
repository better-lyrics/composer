import { useSettingsStore } from "@/stores/settings";
import { type UnisonFeatures, unisonFeatures } from "@/stores/settings-unison";
import { useShallow } from "zustand/react/shallow";

// -- Hook ----------------------------------------------------------------------

function useUnisonFeatures(): UnisonFeatures {
  return useSettingsStore(useShallow(unisonFeatures));
}

// -- Exports -------------------------------------------------------------------

export { useUnisonFeatures };

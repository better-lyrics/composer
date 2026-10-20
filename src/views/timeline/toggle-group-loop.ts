import { useSettingsStore } from "@/stores/settings";

// -- Functions ----------------------------------------------------------------

function toggleGroupLoop(): void {
  const settings = useSettingsStore.getState();
  settings.set("loopRange", !settings.loopRange);
}

// -- Exports ------------------------------------------------------------------

export { toggleGroupLoop };

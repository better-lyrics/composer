import { useSettingsStore } from "@/stores/settings";

// -- Functions ----------------------------------------------------------------

function toggleGroupLoop(): void {
  const settings = useSettingsStore.getState();
  settings.set("loopOpenGroup", !settings.loopOpenGroup);
}

// -- Exports ------------------------------------------------------------------

export { toggleGroupLoop };

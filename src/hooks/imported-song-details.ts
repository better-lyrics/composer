import { useConfirmStore } from "@/stores/confirm-store";

// -- Functions -----------------------------------------------------------------

function confirmClearImportedSongDetails(): Promise<boolean> {
  return useConfirmStore.getState().open({
    title: "Clear the imported song details?",
    description:
      "You imported song details since the last audio was loaded and have not exported the TTML yet. Clear the title, artists and singer names for the new song, or keep them?",
    confirmLabel: "Clear details",
    cancelLabel: "Keep details",
    variant: "destructive",
    settingsKey: "confirmClearImportedSongDetails",
  });
}

// -- Exports -------------------------------------------------------------------

export { confirmClearImportedSongDetails };

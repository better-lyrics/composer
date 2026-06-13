import { create } from "zustand";

// -- Types --------------------------------------------------------------------

type SettingsHighlight = "bridge-section" | null;

interface UIState {
  settingsOpen: boolean;
  settingsHighlight: SettingsHighlight;
  viewingLibrary: boolean;
}

interface UIActions {
  openSettings: (highlight?: SettingsHighlight) => void;
  closeSettings: () => void;
  clearHighlight: () => void;
  setViewingLibrary: (viewing: boolean) => void;
}

// -- Store --------------------------------------------------------------------

const useUIStore = create<UIState & UIActions>((set) => ({
  settingsOpen: false,
  settingsHighlight: null,
  viewingLibrary: true,

  openSettings: (highlight = null) => set({ settingsOpen: true, settingsHighlight: highlight }),
  closeSettings: () => set({ settingsOpen: false, settingsHighlight: null }),
  clearHighlight: () => set({ settingsHighlight: null }),
  setViewingLibrary: (viewing) => set({ viewingLibrary: viewing }),
}));

// -- Exports ------------------------------------------------------------------

export { useUIStore };
export type { SettingsHighlight };

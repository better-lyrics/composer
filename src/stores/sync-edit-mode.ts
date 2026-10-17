import { create } from "zustand";

// -- Interfaces ---------------------------------------------------------------

interface SyncEditModeState {
  editMode: boolean;
}

// -- Store --------------------------------------------------------------------

const useSyncEditModeStore = create<SyncEditModeState>(() => ({ editMode: false }));

// -- Actions ------------------------------------------------------------------

function setSyncEditMode(editMode: boolean): void {
  useSyncEditModeStore.setState({ editMode });
}

// -- Exports ------------------------------------------------------------------

export { setSyncEditMode, useSyncEditModeStore };

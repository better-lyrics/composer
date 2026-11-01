import { create } from "zustand";

// -- Interfaces ---------------------------------------------------------------

interface SyncCountInState {
  startedAt: number | null;
  endsAt: number | null;
  seconds: number;
}

// -- Constants ----------------------------------------------------------------

const SYNC_COUNT_IN_IDLE: SyncCountInState = { startedAt: null, endsAt: null, seconds: 0 };

// -- Selectors ----------------------------------------------------------------

const selectIsCountingIn = (state: SyncCountInState): boolean => state.endsAt !== null;

// -- Store --------------------------------------------------------------------

const useSyncCountInStore = create<SyncCountInState>(() => SYNC_COUNT_IN_IDLE);

// -- Exports ------------------------------------------------------------------

export { SYNC_COUNT_IN_IDLE, selectIsCountingIn, useSyncCountInStore };

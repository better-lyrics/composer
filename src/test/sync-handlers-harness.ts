import { SYNC_START, type SyncAddress, syncAddressAt, syncAddressPosition } from "@/domain/sync/address";
import type { SyncCursor } from "@/domain/sync/cursor";
import { useSyncHandlers } from "@/hooks/useSyncHandlers";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import type { SyncState } from "@/utils/sync-helpers";
import { renderHook } from "vitest-browser-react";

// -- Interfaces ----------------------------------------------------------------

interface HookProps {
  syncState: SyncState;
  currentTime: number;
}

interface MountOptions {
  initialSyncState?: SyncState;
  initialCurrentTime?: number;
  granularity?: "word" | "line";
  editMode?: boolean;
}

// -- Helpers -------------------------------------------------------------------

function at(lineIndex: number, wordIndex: number): SyncAddress {
  return syncAddressAt(useProjectStore.getState().lines, { lineIndex, wordIndex });
}

function positionOf(state: SyncState): SyncCursor {
  return syncAddressPosition(useProjectStore.getState().lines, state.position);
}

function noopBool(_value: boolean): void {}

async function mountSyncHandlers(opts: MountOptions = {}) {
  let syncState: SyncState = opts.initialSyncState ?? { position: SYNC_START, isActive: true };
  const setSyncState = (next: SyncState | ((prev: SyncState) => SyncState)) => {
    syncState = typeof next === "function" ? next(syncState) : next;
  };
  const getSyncState = () => syncState;
  const startTime = opts.initialCurrentTime ?? 0;
  const playingCalls: boolean[] = [];
  if (opts.initialCurrentTime !== undefined) useAudioStore.setState({ currentTime: opts.initialCurrentTime });

  const { result, rerender, act } = await renderHook(
    (props?: HookProps) => {
      const lines = useProjectStore.getState().lines;
      const state = props?.syncState ?? syncState;
      return useSyncHandlers({
        lines,
        syncState: state,
        setSyncState,
        editMode: opts.editMode ?? false,
        granularity: opts.granularity ?? "word",
        setShowPulse: noopBool,
        setIsPlaying: (value) => playingCalls.push(value),
      });
    },
    { initialProps: { syncState, currentTime: startTime } },
  );

  const rerenderAt = async (props: HookProps) => {
    useAudioStore.setState({ currentTime: props.currentTime });
    await rerender(props);
  };

  return { result, rerender: rerenderAt, act, getSyncState, playingCalls };
}

// -- Exports -------------------------------------------------------------------

export { at, mountSyncHandlers, positionOf };

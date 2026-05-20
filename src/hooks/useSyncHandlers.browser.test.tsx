import { useSyncHandlers } from "@/hooks/useSyncHandlers";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import type { SyncState } from "@/utils/sync-helpers";
import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

const ORIGINAL_TEXT = "Hello world how are you";

interface HookProps {
  syncState: SyncState;
  currentTime: number;
}

function noopBool(_value: boolean): void {}

describe("useSyncHandlers.handleTap (word granularity)", () => {
  it("preserves line.text across a full word-by-word tap sequence", async () => {
    useProjectStore.getState().setLines([createLine({ id: "l0", text: ORIGINAL_TEXT })]);

    let syncState: SyncState = { position: { lineIndex: 0, wordIndex: 0 }, isActive: true };
    const setSyncState = (next: SyncState | ((prev: SyncState) => SyncState)) => {
      syncState = typeof next === "function" ? next(syncState) : next;
    };

    const { result, rerender, act } = await renderHook(
      (props?: HookProps) => {
        const currentSync = props?.syncState ?? syncState;
        const currentTime = props?.currentTime ?? 0;
        return useSyncHandlers({
          lines: useProjectStore.getState().lines,
          syncState: currentSync,
          setSyncState,
          currentTime,
          editMode: false,
          granularity: "word",
          setShowPulse: noopBool,
          setIsPlaying: noopBool,
        });
      },
      { initialProps: { syncState, currentTime: 0 } },
    );

    for (let tap = 0; tap < 5; tap++) {
      const currentTime = tap * 0.5;
      await act(() => {
        result.current.handleTap();
      });
      expect(useProjectStore.getState().lines[0].text).toBe(ORIGINAL_TEXT);
      await rerender({ syncState, currentTime: currentTime + 0.5 });
    }

    expect(useProjectStore.getState().lines[0].words?.length).toBe(5);
    expect(useProjectStore.getState().lines[0].text).toBe(ORIGINAL_TEXT);
  });
});

import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createLine } from "@/test/factories";
import { mountSyncHandlers } from "@/test/sync-handlers-harness";
import { handleWordChangeWithDivergenceCheck } from "@/utils/word-divergence-flow";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  useSettingsStore.setState({ syncCountIn: 0 });
});

describe("useSyncHandlers cursor address", () => {
  it("regression: a split before the cursor never re-records the last timed word", async () => {
    useProjectStore.getState().setLines([createLine({ id: "l0", text: "Rivers carry lanterns home" })]);
    const { result, rerender, act, getSyncState } = await mountSyncHandlers();
    for (const time of [0, 0.5]) {
      await rerender({ syncState: getSyncState(), currentTime: time });
      await act(() => result.current.handleTap());
    }
    const river = useProjectStore.getState().lines[0].words?.[0];
    if (!river) throw new Error("expected a timed first word");

    await act(() =>
      handleWordChangeWithDivergenceCheck("l0", [
        { ...river, text: "Riv", sep: "", end: 0.25 },
        { ...river, id: "riv-second", text: "ers", begin: 0.25 },
        ...(useProjectStore.getState().lines[0].words ?? []).slice(1),
      ]),
    );
    await rerender({ syncState: getSyncState(), currentTime: 1 });
    await act(() => result.current.handleTap());

    const words = useProjectStore.getState().lines[0].words ?? [];
    expect(words.map((word) => word.text)).toEqual(["Riv", "ers", "carry", "lanterns"]);
    expect(words.map((word) => word.begin)).toEqual([0, 0.25, 0.5, 1]);
  });
});

import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useTimelineSnap } from "@/views/timeline/use-timeline-snap";
import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

// -- Helpers ------------------------------------------------------------------

const ZOOM = 100;
const THRESHOLD = 12;
const SELF_IDS = new Set<string>();
const ALLOW_SHIFT = () => true;

function beginAt(result: { current: ReturnType<typeof useTimelineSnap> }): void {
  result.current.beginGesture({ selfIds: SELF_IDS, leaderKey: "leader", overlapCheck: ALLOW_SHIFT });
}

// -- Tests --------------------------------------------------------------------

describe("useTimelineSnap · custom snap points", () => {
  beforeEach(() => {
    useAudioStore.setState({ audioElement: null, currentTime: 0, duration: 30 });
    useProjectStore.setState({ lines: [] });
    useTimelineStore.setState({
      zoom: ZOOM,
      isBypassing: false,
      vocalOnsetSnapPoints: [],
      customSnapPoints: [],
      snappedBlockId: null,
      snappedAnchorTime: null,
    });
    useSettingsStore.setState({
      timelineSnap: false,
      vocalOnsetSnap: false,
      timelineSnapThreshold: THRESHOLD,
    });
  });

  it("snaps a block to a custom point when both timelineSnap and vocalOnsetSnap are OFF", async () => {
    useTimelineStore.setState({ customSnapPoints: [1] });
    const { result } = await renderHook(() => useTimelineSnap());

    beginAt(result);

    const edge = 0.95;
    const proposedDeltaPx = 0;
    const shiftPx = result.current.computeShiftPx(proposedDeltaPx, [edge]);

    expect(shiftPx).toBeCloseTo((1 - edge) * ZOOM, 4);
    expect(useTimelineStore.getState().snappedAnchorTime).toBeCloseTo(1, 4);
  });

  it("does not snap when there are no custom points and both snaps are OFF", async () => {
    useTimelineStore.setState({ customSnapPoints: [] });
    const { result } = await renderHook(() => useTimelineSnap());

    beginAt(result);

    const shiftPx = result.current.computeShiftPx(0, [0.95]);

    expect(shiftPx).toBe(0);
    expect(useTimelineStore.getState().snappedAnchorTime).toBeNull();
  });

  it("snaps to the nearest of a custom point and a vocal onset when both are active (additive)", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: true });
    useTimelineStore.setState({ customSnapPoints: [1], vocalOnsetSnapPoints: [2] });
    const { result } = await renderHook(() => useTimelineSnap());

    beginAt(result);

    const nearOnsetShift = result.current.computeShiftPx(0, [2.05]);
    expect(nearOnsetShift).toBeCloseTo((2 - 2.05) * ZOOM, 4);
    expect(useTimelineStore.getState().snappedAnchorTime).toBeCloseTo(2, 4);

    const nearCustomShift = result.current.computeShiftPx(0, [0.95]);
    expect(nearCustomShift).toBeCloseTo((1 - 0.95) * ZOOM, 4);
    expect(useTimelineStore.getState().snappedAnchorTime).toBeCloseTo(1, 4);
  });

  it("keeps vocal onsets gated by vocalOnsetSnap even when a custom point enables snapping", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: false });
    useTimelineStore.setState({ customSnapPoints: [1], vocalOnsetSnapPoints: [2] });
    const { result } = await renderHook(() => useTimelineSnap());

    beginAt(result);

    const shiftPx = result.current.computeShiftPx(0, [2.05]);

    expect(shiftPx).toBe(0);
    expect(useTimelineStore.getState().snappedAnchorTime).toBeNull();
  });

  it("does not emit timeline grid anchors when timelineSnap is OFF but a custom point exists", async () => {
    useProjectStore.setState({
      lines: [{ id: "g1", text: "grid", agentId: "v1", begin: 2, end: 3 }],
    });
    useTimelineStore.setState({ customSnapPoints: [1] });
    const { result } = await renderHook(() => useTimelineSnap());

    beginAt(result);

    const nearGrid = result.current.computeShiftPx(0, [1.98]);
    expect(nearGrid).toBe(0);
    expect(useTimelineStore.getState().snappedAnchorTime).toBeNull();

    const nearCustom = result.current.computeShiftPx(0, [0.95]);
    expect(nearCustom).toBeCloseTo((1 - 0.95) * ZOOM, 4);
    expect(useTimelineStore.getState().snappedAnchorTime).toBeCloseTo(1, 4);
  });
});

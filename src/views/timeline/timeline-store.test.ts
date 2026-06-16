import { beforeEach, describe, expect, it } from "vitest";
import { useTimelineStore } from "@/views/timeline/timeline-store";

describe("rollingEditMode", () => {
  it("defaults to off and toggles", () => {
    useTimelineStore.setState({ rollingEditMode: false });
    expect(useTimelineStore.getState().rollingEditMode).toBe(false);
    useTimelineStore.getState().toggleRollingEditMode();
    expect(useTimelineStore.getState().rollingEditMode).toBe(true);
  });
});

describe("markerMode", () => {
  beforeEach(() => {
    useTimelineStore.setState({ markerMode: false });
  });

  it("defaults to false", () => {
    expect(useTimelineStore.getState().markerMode).toBe(false);
  });

  it("toggleMarkerMode flips it", () => {
    useTimelineStore.getState().toggleMarkerMode();
    expect(useTimelineStore.getState().markerMode).toBe(true);
  });

  describe("invariants", () => {
    it("toggling twice returns to false", () => {
      const s = useTimelineStore.getState();
      s.toggleMarkerMode();
      s.toggleMarkerMode();
      expect(useTimelineStore.getState().markerMode).toBe(false);
    });
  });
});

import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { snapPlayheadTime } from "@/views/timeline/playhead-snap";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { beforeEach, describe, expect, it } from "vitest";

describe("snapPlayheadTime", () => {
  beforeEach(() => {
    useSettingsStore.setState({ snapPlayheadToPoints: true, vocalOnsetSnap: true, timelineSnapThreshold: 12 });
    useTimelineStore.setState({ zoom: 100, vocalOnsetSnapPoints: [] });
    useProjectStore.setState({ customSnapPoints: [5] });
  });

  it("snaps to a pin when the time is within the pixel threshold", () => {
    expect(snapPlayheadTime(5.05, false)).toBe(5);
  });

  it("leaves the time unchanged when it is beyond the pixel threshold", () => {
    expect(snapPlayheadTime(5.2, false)).toBe(5.2);
  });

  it("returns the time unchanged when snapPlayheadToPoints is off", () => {
    useSettingsStore.setState({ snapPlayheadToPoints: false });
    expect(snapPlayheadTime(5.05, false)).toBe(5.05);
  });

  it("returns the time unchanged when bypass is true", () => {
    expect(snapPlayheadTime(5.05, true)).toBe(5.05);
  });

  it("includes vocal onsets as anchors when vocalOnsetSnap is on", () => {
    useProjectStore.setState({ customSnapPoints: [] });
    useTimelineStore.setState({ vocalOnsetSnapPoints: [8] });
    expect(snapPlayheadTime(8.05, false)).toBe(8);
  });

  describe("edge cases", () => {
    it("excludes vocal onsets when vocalOnsetSnap is off", () => {
      useSettingsStore.setState({ vocalOnsetSnap: false });
      useProjectStore.setState({ customSnapPoints: [] });
      useTimelineStore.setState({ vocalOnsetSnapPoints: [8] });
      expect(snapPlayheadTime(8.05, false)).toBe(8.05);
    });

    it("returns the time unchanged when there are no anchors at all", () => {
      useProjectStore.setState({ customSnapPoints: [] });
      useTimelineStore.setState({ vocalOnsetSnapPoints: [] });
      expect(snapPlayheadTime(3.14, false)).toBe(3.14);
    });

    it("snaps to the nearer of a pin and an onset when both are within range", () => {
      useProjectStore.setState({ customSnapPoints: [5] });
      useTimelineStore.setState({ vocalOnsetSnapPoints: [5.1] });
      expect(snapPlayheadTime(5.06, false)).toBe(5.1);
    });

    it("snaps to the timeline origin", () => {
      useProjectStore.setState({ customSnapPoints: [0] });
      useTimelineStore.setState({ vocalOnsetSnapPoints: [] });
      expect(snapPlayheadTime(0.05, false)).toBe(0);
    });
  });
});

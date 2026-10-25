import { detectedGrid } from "@/domain/tempo/beat-grid";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { snapPoints } from "@/test/factories";
import { resetAllStores } from "@/test/stores";
import { pointSnapTimes } from "@/views/timeline/point-snap-anchors";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { beforeEach, describe, expect, it } from "vitest";

const EVERYTHING = { includeMarkers: true, includeOnsets: true, includeBeats: true };

describe("pointSnapTimes", () => {
  beforeEach(async () => {
    await resetAllStores();
    useAudioStore.setState({ duration: 10 });
    useSettingsStore.setState({ beatGridLines: "2" });
    useTimelineStore.setState({ zoom: 100, vocalOnsetSnapPoints: [0.6] });
    useProjectStore.setState({
      customSnapPoints: snapPoints([0.9]),
      beatGrid: detectedGrid({ beats: [0, 0.5, 1], downbeats: [0] }),
    });
  });

  it("returns markers, onsets and visible grid lines in time order", () => {
    expect(pointSnapTimes(EVERYTHING)).toEqual([0, 0.25, 0.5, 0.6, 0.75, 0.9, 1]);
  });

  it("leaves out each source the caller does not include", () => {
    expect(pointSnapTimes({ ...EVERYTHING, includeMarkers: false })).not.toContain(0.9);
    expect(pointSnapTimes({ ...EVERYTHING, includeOnsets: false })).not.toContain(0.6);
    expect(pointSnapTimes({ ...EVERYTHING, includeBeats: false })).toEqual([0.6, 0.9]);
  });

  it("leaves out each source whose setting is off", () => {
    useSettingsStore.setState({ snapMarkers: false });
    expect(pointSnapTimes(EVERYTHING)).not.toContain(0.9);
    useSettingsStore.setState({ snapMarkers: true, vocalOnsetSnap: false });
    expect(pointSnapTimes(EVERYTHING)).not.toContain(0.6);
    useSettingsStore.setState({ vocalOnsetSnap: true, beatSnap: false });
    expect(pointSnapTimes(EVERYTHING)).toEqual([0.6, 0.9]);
    useSettingsStore.setState({ beatSnap: true, beatGridVisible: false });
    expect(pointSnapTimes(EVERYTHING)).toEqual([0.6, 0.9]);
  });

  it("drops grid lines thinned at the current zoom", () => {
    useTimelineStore.setState({ zoom: 40 });
    expect(pointSnapTimes({ ...EVERYTHING, includeMarkers: false, includeOnsets: false })).toEqual([0, 0.5, 1]);
  });

  it("returns nothing when the Snap latch is off", () => {
    useSettingsStore.setState({ timelineSnap: false });
    expect(pointSnapTimes(EVERYTHING)).toEqual([]);
  });
});

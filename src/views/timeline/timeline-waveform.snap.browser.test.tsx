import { describe, expect, it } from "vitest";
import { TimelineWaveform } from "@/views/timeline/timeline-waveform";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { createAudioFile } from "@/test/audio-fixtures";
import { render } from "@/test/render";

function setupWaveformAudio(duration = 30) {
  useAudioStore.setState({
    source: { type: "file", file: createAudioFile() },
    duration,
  });
}

function stubRect(element: HTMLElement, width: number): void {
  Object.defineProperty(element, "getBoundingClientRect", {
    value: () => ({ left: 0, top: 0, right: width, bottom: 80, width, height: 80, x: 0, y: 0, toJSON: () => "" }),
  });
}

function trackSeek(): { get: () => number } {
  let seeked = -1;
  useAudioStore.setState({
    seekTo: (time: number) => {
      seeked = time;
    },
  } as Parameters<typeof useAudioStore.setState>[0]);
  return { get: () => seeked };
}

function getClickLayer(container: HTMLElement, width: number): HTMLElement {
  const layer = container.querySelector('[role="button"]') as HTMLElement;
  stubRect(layer, width);
  return layer;
}

describe("TimelineWaveform click-seek snapping", () => {
  it("snaps a plain click to a nearby pin when the setting is on", async () => {
    setupWaveformAudio(30);
    useProjectStore.setState({ customSnapPoints: [15] });
    useTimelineStore.setState({ zoom: 50, markerMode: false, vocalOnsetSnapPoints: [] });
    useSettingsStore.setState({ snapPlayheadToPoints: true, vocalOnsetSnap: true, timelineSnapThreshold: 12 });
    const seek = trackSeek();
    const screen = await render(<TimelineWaveform />);
    const layer = getClickLayer(screen.container, 1500);

    layer.dispatchEvent(new MouseEvent("click", { clientX: 755, clientY: 40, bubbles: true }));

    expect(seek.get()).toBeCloseTo(15, 6);
  });

  it("does not snap a Cmd+click: it seeks the raw clicked time", async () => {
    setupWaveformAudio(30);
    useProjectStore.setState({ customSnapPoints: [15] });
    useTimelineStore.setState({ zoom: 50, markerMode: false, vocalOnsetSnapPoints: [] });
    useSettingsStore.setState({ snapPlayheadToPoints: true, vocalOnsetSnap: true, timelineSnapThreshold: 12 });
    const seek = trackSeek();
    const screen = await render(<TimelineWaveform />);
    const layer = getClickLayer(screen.container, 1500);

    layer.dispatchEvent(new MouseEvent("click", { metaKey: true, clientX: 755, clientY: 40, bubbles: true }));

    expect(seek.get()).toBeCloseTo(15.1, 6);
  });

  it("does not snap when the snapPlayheadToPoints setting is off", async () => {
    setupWaveformAudio(30);
    useProjectStore.setState({ customSnapPoints: [15] });
    useTimelineStore.setState({ zoom: 50, markerMode: false, vocalOnsetSnapPoints: [] });
    useSettingsStore.setState({ snapPlayheadToPoints: false, vocalOnsetSnap: true, timelineSnapThreshold: 12 });
    const seek = trackSeek();
    const screen = await render(<TimelineWaveform />);
    const layer = getClickLayer(screen.container, 1500);

    layer.dispatchEvent(new MouseEvent("click", { clientX: 755, clientY: 40, bubbles: true }));

    expect(seek.get()).toBeCloseTo(15.1, 6);
  });

  it("seeks the raw time when no pin is within threshold of the click", async () => {
    setupWaveformAudio(30);
    useProjectStore.setState({ customSnapPoints: [2, 27] });
    useTimelineStore.setState({ zoom: 50, markerMode: false, vocalOnsetSnapPoints: [] });
    useSettingsStore.setState({ snapPlayheadToPoints: true, vocalOnsetSnap: true, timelineSnapThreshold: 12 });
    const seek = trackSeek();
    const screen = await render(<TimelineWaveform />);
    const layer = getClickLayer(screen.container, 1500);

    layer.dispatchEvent(new MouseEvent("click", { clientX: 755, clientY: 40, bubbles: true }));

    expect(seek.get()).toBeCloseTo(15.1, 6);
  });

  it("Alt+click still places a point and never seeks, unaffected by the seek snap wrapper", async () => {
    setupWaveformAudio(30);
    useProjectStore.setState({ customSnapPoints: [] });
    useTimelineStore.setState({ zoom: 50, markerMode: false, vocalOnsetSnapPoints: [] });
    useSettingsStore.setState({ snapPlayheadToPoints: true, vocalOnsetSnap: true, timelineSnapThreshold: 12 });
    const seek = trackSeek();
    const screen = await render(<TimelineWaveform />);
    const layer = getClickLayer(screen.container, 1500);

    layer.dispatchEvent(new MouseEvent("click", { altKey: true, clientX: 755, clientY: 40, bubbles: true }));

    await expect.poll(() => useProjectStore.getState().customSnapPoints.length).toBe(1);
    expect(useProjectStore.getState().customSnapPoints[0]).toBeCloseTo(15.1, 6);
    expect(seek.get()).toBe(-1);
  });
});

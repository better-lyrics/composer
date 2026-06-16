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

describe("TimelineWaveform marker placement", () => {
  function getClickLayer(container: HTMLElement, width: number): HTMLElement {
    const layer = container.querySelector('[role="button"]') as HTMLElement;
    stubRect(layer, width);
    return layer;
  }

  it("marker mode ON: single click adds a custom point at the clicked time and does not seek", async () => {
    setupWaveformAudio(30);
    useTimelineStore.setState({ zoom: 50, markerMode: true, vocalOnsetSnapPoints: [] });
    useProjectStore.setState({ customSnapPoints: [] });
    const seek = trackSeek();
    const screen = await render(<TimelineWaveform />);
    const layer = getClickLayer(screen.container, 1500);

    layer.dispatchEvent(new MouseEvent("click", { clientX: 750, clientY: 40, bubbles: true }));

    await expect.poll(() => useProjectStore.getState().customSnapPoints.length).toBe(1);
    expect(useProjectStore.getState().customSnapPoints[0]).toBeCloseTo(15, 3);
    expect(seek.get()).toBe(-1);
  });

  it("marker mode ON: clicking near an onset within threshold snaps the added point onto the onset", async () => {
    setupWaveformAudio(30);
    useSettingsStore.setState({ vocalOnsetSnap: true, timelineSnapThreshold: 12 });
    useTimelineStore.setState({ zoom: 50, markerMode: true, vocalOnsetSnapPoints: [15.1] });
    useProjectStore.setState({ customSnapPoints: [] });
    const screen = await render(<TimelineWaveform />);
    const layer = getClickLayer(screen.container, 1500);

    layer.dispatchEvent(new MouseEvent("click", { clientX: 750, clientY: 40, bubbles: true }));

    await expect.poll(() => useProjectStore.getState().customSnapPoints.length).toBe(1);
    expect(useProjectStore.getState().customSnapPoints[0]).toBeCloseTo(15.1, 6);
  });

  it("marker mode ON: clicking with no onsets nearby adds the raw clicked time", async () => {
    setupWaveformAudio(30);
    useSettingsStore.setState({ vocalOnsetSnap: true, timelineSnapThreshold: 12 });
    useTimelineStore.setState({ zoom: 50, markerMode: true, vocalOnsetSnapPoints: [2, 27] });
    useProjectStore.setState({ customSnapPoints: [] });
    const screen = await render(<TimelineWaveform />);
    const layer = getClickLayer(screen.container, 1500);

    layer.dispatchEvent(new MouseEvent("click", { clientX: 750, clientY: 40, bubbles: true }));

    await expect.poll(() => useProjectStore.getState().customSnapPoints.length).toBe(1);
    expect(useProjectStore.getState().customSnapPoints[0]).toBeCloseTo(15, 3);
  });

  it("marker mode ON: a double-click does not add a second point on top of the single-click adds", async () => {
    setupWaveformAudio(30);
    useTimelineStore.setState({ zoom: 50, markerMode: true, vocalOnsetSnapPoints: [] });
    useProjectStore.setState({ customSnapPoints: [] });
    const screen = await render(<TimelineWaveform />);
    const layer = getClickLayer(screen.container, 1500);

    layer.dispatchEvent(new MouseEvent("dblclick", { clientX: 750, clientY: 40, bubbles: true }));

    await expect.poll(() => useProjectStore.getState().customSnapPoints.length).toBe(0);
  });

  it("marker mode ON: a real physical double-click sequence adds exactly one point", async () => {
    setupWaveformAudio(30);
    useTimelineStore.setState({ zoom: 50, markerMode: true, vocalOnsetSnapPoints: [] });
    useProjectStore.setState({ customSnapPoints: [] });
    const screen = await render(<TimelineWaveform />);
    const layer = getClickLayer(screen.container, 1500);

    layer.dispatchEvent(new MouseEvent("click", { detail: 1, clientX: 750, clientY: 40, bubbles: true }));
    layer.dispatchEvent(new MouseEvent("click", { detail: 2, clientX: 750, clientY: 40, bubbles: true }));
    layer.dispatchEvent(new MouseEvent("dblclick", { detail: 2, clientX: 750, clientY: 40, bubbles: true }));

    await expect.poll(() => useProjectStore.getState().customSnapPoints.length).toBe(1);
    expect(useProjectStore.getState().customSnapPoints[0]).toBeCloseTo(15, 3);
  });

  it("marker mode ON: a triple-click sequence still adds exactly one point", async () => {
    setupWaveformAudio(30);
    useTimelineStore.setState({ zoom: 50, markerMode: true, vocalOnsetSnapPoints: [] });
    useProjectStore.setState({ customSnapPoints: [] });
    const screen = await render(<TimelineWaveform />);
    const layer = getClickLayer(screen.container, 1500);

    layer.dispatchEvent(new MouseEvent("click", { detail: 1, clientX: 750, clientY: 40, bubbles: true }));
    layer.dispatchEvent(new MouseEvent("click", { detail: 2, clientX: 750, clientY: 40, bubbles: true }));
    layer.dispatchEvent(new MouseEvent("click", { detail: 3, clientX: 750, clientY: 40, bubbles: true }));

    await expect.poll(() => useProjectStore.getState().customSnapPoints.length).toBe(1);
    expect(useProjectStore.getState().customSnapPoints[0]).toBeCloseTo(15, 3);
  });

  it("marker mode ON takes precedence over Alt: an Alt double-click still nets exactly one point and never seeks", async () => {
    setupWaveformAudio(30);
    useTimelineStore.setState({ zoom: 50, markerMode: true, vocalOnsetSnapPoints: [] });
    useProjectStore.setState({ customSnapPoints: [] });
    const seek = trackSeek();
    const screen = await render(<TimelineWaveform />);
    const layer = getClickLayer(screen.container, 1500);

    layer.dispatchEvent(new MouseEvent("click", { altKey: true, detail: 1, clientX: 750, clientY: 40, bubbles: true }));
    layer.dispatchEvent(new MouseEvent("click", { altKey: true, detail: 2, clientX: 750, clientY: 40, bubbles: true }));

    await expect.poll(() => useProjectStore.getState().customSnapPoints.length).toBe(1);
    expect(useProjectStore.getState().customSnapPoints[0]).toBeCloseTo(15, 3);
    expect(seek.get()).toBe(-1);
  });

  it("marker mode OFF: single click seeks and adds no point", async () => {
    setupWaveformAudio(30);
    useTimelineStore.setState({ zoom: 50, markerMode: false, vocalOnsetSnapPoints: [] });
    useProjectStore.setState({ customSnapPoints: [] });
    const seek = trackSeek();
    const screen = await render(<TimelineWaveform />);
    const layer = getClickLayer(screen.container, 1500);

    layer.dispatchEvent(new MouseEvent("click", { clientX: 750, clientY: 40, bubbles: true }));

    expect(seek.get()).toBeCloseTo(15, 3);
    expect(useProjectStore.getState().customSnapPoints.length).toBe(0);
  });

  it("marker mode OFF: Alt+click drops a point and does not seek", async () => {
    setupWaveformAudio(30);
    useTimelineStore.setState({ zoom: 50, markerMode: false, vocalOnsetSnapPoints: [] });
    useProjectStore.setState({ customSnapPoints: [] });
    const seek = trackSeek();
    const screen = await render(<TimelineWaveform />);
    const layer = getClickLayer(screen.container, 1500);

    layer.dispatchEvent(new MouseEvent("click", { altKey: true, clientX: 750, clientY: 40, bubbles: true }));

    await expect.poll(() => useProjectStore.getState().customSnapPoints.length).toBe(1);
    expect(useProjectStore.getState().customSnapPoints[0]).toBeCloseTo(15, 3);
    expect(seek.get()).toBe(-1);
  });

  it("marker mode OFF: Alt+click snaps the dropped point to a nearby onset within threshold", async () => {
    setupWaveformAudio(30);
    useSettingsStore.setState({ vocalOnsetSnap: true, timelineSnapThreshold: 12 });
    useTimelineStore.setState({ zoom: 50, markerMode: false, vocalOnsetSnapPoints: [15.1] });
    useProjectStore.setState({ customSnapPoints: [] });
    const screen = await render(<TimelineWaveform />);
    const layer = getClickLayer(screen.container, 1500);

    layer.dispatchEvent(new MouseEvent("click", { altKey: true, clientX: 750, clientY: 40, bubbles: true }));

    await expect.poll(() => useProjectStore.getState().customSnapPoints.length).toBe(1);
    expect(useProjectStore.getState().customSnapPoints[0]).toBeCloseTo(15.1, 6);
  });

  it("onset snapping is suppressed when the vocalOnsetSnap setting is off, mirroring the drag", async () => {
    setupWaveformAudio(30);
    useSettingsStore.setState({ vocalOnsetSnap: false, timelineSnapThreshold: 12 });
    useTimelineStore.setState({ zoom: 50, markerMode: true, vocalOnsetSnapPoints: [15.1] });
    useProjectStore.setState({ customSnapPoints: [] });
    const screen = await render(<TimelineWaveform />);
    const layer = getClickLayer(screen.container, 1500);

    layer.dispatchEvent(new MouseEvent("click", { clientX: 750, clientY: 40, bubbles: true }));

    await expect.poll(() => useProjectStore.getState().customSnapPoints.length).toBe(1);
    expect(useProjectStore.getState().customSnapPoints[0]).toBeCloseTo(15, 3);
  });
});

describe("TimelineWaveform marker-mode armed state", () => {
  function getClickLayer(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[role="button"][aria-label]');
  }

  it("does not carry the armed class and reads as a seek affordance when marker mode is off", async () => {
    setupWaveformAudio(30);
    useTimelineStore.setState({ markerMode: false });
    await render(<TimelineWaveform />);
    const layer = getClickLayer();
    expect(layer?.className).not.toContain("waveform-armed");
    expect(layer?.className).toContain("cursor-pointer");
    expect(layer?.getAttribute("aria-label")).toBe("Seek to position");
  });

  it("carries the armed class and reads as a placement affordance when marker mode is on", async () => {
    setupWaveformAudio(30);
    useTimelineStore.setState({ markerMode: true });
    await render(<TimelineWaveform />);
    const layer = getClickLayer();
    expect(layer?.className).toContain("waveform-armed");
    expect(layer?.className).not.toContain("cursor-pointer");
    expect(layer?.getAttribute("aria-label")).toBe("Place snap point");
  });

  it("flips the armed class reactively when marker mode toggles in the store", async () => {
    setupWaveformAudio(30);
    useTimelineStore.setState({ markerMode: false });
    const screen = await render(<TimelineWaveform />);
    const layer = () => screen.container.querySelector<HTMLElement>('[role="button"][aria-label]');
    expect(layer()?.className).not.toContain("waveform-armed");

    useTimelineStore.setState({ markerMode: true });
    await expect.poll(() => layer()?.className).toContain("waveform-armed");
    expect(layer()?.getAttribute("aria-label")).toBe("Place snap point");
    expect(layer()?.className).not.toContain("cursor-pointer");

    useTimelineStore.setState({ markerMode: false });
    await expect.poll(() => layer()?.className).not.toContain("waveform-armed");
    expect(layer()?.getAttribute("aria-label")).toBe("Seek to position");
    expect(layer()?.className).toContain("cursor-pointer");
  });
});

describe("TimelineWaveform marker delete control", () => {
  it("regression: clicking a marker's portalled delete control does not seek or add a point", async () => {
    setupWaveformAudio(30);
    useTimelineStore.setState({ zoom: 50, markerMode: false, vocalOnsetSnapPoints: [] });
    useProjectStore.setState({ customSnapPoints: [] });
    const seek = trackSeek();
    const screen = await render(<TimelineWaveform />);
    stubRect(screen.container.querySelector('[role="button"]') as HTMLElement, 1500);

    const tooltip = document.createElement("div");
    tooltip.setAttribute("data-snap-marker-tooltip", "");
    const del = document.createElement("button");
    del.setAttribute("data-snap-marker-delete", "");
    tooltip.appendChild(del);
    document.body.appendChild(tooltip);

    del.dispatchEvent(new MouseEvent("click", { clientX: 750, clientY: 40, bubbles: true }));
    del.dispatchEvent(new MouseEvent("click", { clientX: 750, clientY: 40, bubbles: true }));
    tooltip.remove();

    expect(seek.get()).toBe(-1);
    expect(useProjectStore.getState().customSnapPoints.length).toBe(0);
  });
});

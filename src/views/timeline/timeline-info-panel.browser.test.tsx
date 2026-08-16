import { describe, expect, it } from "vitest";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { TimelineInfoPanel } from "@/views/timeline/timeline-info-panel";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Helpers ------------------------------------------------------------------

function selectWordAt(lineId: string, wordIndex: number): void {
  useTimelineStore.setState({
    selectedWords: [{ lineId, lineIndex: 0, wordIndex, type: "word" }],
  });
}

function flushPairLine() {
  return createLine({
    id: "l1",
    text: "hello world",
    words: [createWord({ text: "hello ", begin: 0, end: 1 }), createWord({ text: "world", begin: 1, end: 2 })],
  });
}

function currentWords() {
  return useProjectStore.getState().lines[0].words ?? [];
}

// -- Tests --------------------------------------------------------------------

describe("TimelineInfoPanel", () => {
  it("renders nothing visible when no words are selected", async () => {
    useTimelineStore.setState({ selectedWords: [] });
    const screen = await render(<TimelineInfoPanel />);
    expect(screen.container.textContent?.trim() ?? "").toBe("");
  });
});

describe("TimelineInfoPanel bg word retiming provenance", () => {
  function lineWithBg() {
    return createLine({
      id: "l1",
      text: "main",
      words: [createWord({ text: "main", begin: 0, end: 1 })],
      backgroundText: "ooh",
      backgroundWords: [createWord({ text: "ooh", begin: 1, end: 2 })],
      backgroundTextSource: "extraction",
    });
  }

  it("stamps backgroundTextSource manual when a bg word's begin is set to the cursor", async () => {
    useAudioStore.setState({ currentTime: 1.3, duration: 10 });
    useProjectStore.setState({ lines: [lineWithBg()] });
    useTimelineStore.setState({ selectedWords: [{ lineId: "l1", lineIndex: 0, wordIndex: 0, type: "bg" }] });
    const screen = await render(<TimelineInfoPanel />);

    await screen.getByRole("button", { name: /Set Begin/ }).click();

    await expect.poll(() => useProjectStore.getState().lines[0].backgroundWords?.[0].begin).toBeCloseTo(1.3);
    expect(useProjectStore.getState().lines[0].backgroundTextSource).toBe("manual");
  });

  it("stamps backgroundTextSource manual when a bg word's end is set to the cursor", async () => {
    useAudioStore.setState({ currentTime: 1.7, duration: 10 });
    useProjectStore.setState({ lines: [lineWithBg()] });
    useTimelineStore.setState({ selectedWords: [{ lineId: "l1", lineIndex: 0, wordIndex: 0, type: "bg" }] });
    const screen = await render(<TimelineInfoPanel />);

    await screen.getByRole("button", { name: /Set End/ }).click();

    await expect.poll(() => useProjectStore.getState().lines[0].backgroundWords?.[0].end).toBeCloseTo(1.7);
    expect(useProjectStore.getState().lines[0].backgroundTextSource).toBe("manual");
  });

  it("leaves background provenance untouched when a main word's begin is retimed", async () => {
    useAudioStore.setState({ currentTime: 0.4, duration: 10 });
    useProjectStore.setState({ lines: [lineWithBg()] });
    useTimelineStore.setState({ selectedWords: [{ lineId: "l1", lineIndex: 0, wordIndex: 0, type: "word" }] });
    const screen = await render(<TimelineInfoPanel />);

    await screen.getByRole("button", { name: /Set Begin/ }).click();

    await expect.poll(() => useProjectStore.getState().lines[0].words?.[0].begin).toBeCloseTo(0.4);
    expect(useProjectStore.getState().lines[0].backgroundTextSource).toBe("extraction");
  });
});

describe("TimelineInfoPanel cursor buttons · rolling edit", () => {
  it("moves the previous word's end with Set Begin when rolling over a flush boundary", async () => {
    useAudioStore.setState({ currentTime: 1.4, duration: 10 });
    useProjectStore.setState({ lines: [flushPairLine()] });
    useTimelineStore.setState({ rollingEditMode: true });
    selectWordAt("l1", 1);
    const screen = await render(<TimelineInfoPanel />);

    await screen.getByRole("button", { name: /Set Begin/ }).click();

    await expect.poll(() => currentWords()[1].begin).toBeCloseTo(1.4, 10);
    expect(currentWords()[0].end).toBeCloseTo(1.4, 10);
  });

  it("moves the next word's begin with Set End when rolling over a flush boundary", async () => {
    useAudioStore.setState({ currentTime: 1.4, duration: 10 });
    useProjectStore.setState({ lines: [flushPairLine()] });
    useTimelineStore.setState({ rollingEditMode: true });
    selectWordAt("l1", 0);
    const screen = await render(<TimelineInfoPanel />);

    await screen.getByRole("button", { name: /Set End/ }).click();

    await expect.poll(() => currentWords()[0].end).toBeCloseTo(1.4, 10);
    expect(currentWords()[1].begin).toBeCloseTo(1.4, 10);
  });

  it("moves only the selected word when rolling edit is off", async () => {
    useAudioStore.setState({ currentTime: 1.4, duration: 10 });
    useProjectStore.setState({ lines: [flushPairLine()] });
    useTimelineStore.setState({ rollingEditMode: false });
    selectWordAt("l1", 1);
    const screen = await render(<TimelineInfoPanel />);

    await screen.getByRole("button", { name: /Set Begin/ }).click();

    await expect.poll(() => currentWords()[1].begin).toBeCloseTo(1.4, 10);
    expect(currentWords()[0].end).toBe(1);
  });

  it("records a rolling edit as a single undo entry", async () => {
    useAudioStore.setState({ currentTime: 1.4, duration: 10 });
    useProjectStore.setState({ lines: [flushPairLine()] });
    useTimelineStore.setState({ rollingEditMode: true });
    selectWordAt("l1", 1);
    const screen = await render(<TimelineInfoPanel />);

    await screen.getByRole("button", { name: /Set Begin/ }).click();
    await expect.poll(() => currentWords()[0].end).toBeCloseTo(1.4, 10);
    expect(useProjectStore.getState().history).toHaveLength(2);

    useProjectStore.getState().undo();

    expect(currentWords()[0].end).toBe(1);
    expect(currentWords()[1].begin).toBe(1);
  });

  it("clamps Set Begin with the configured minimum word duration", async () => {
    useSettingsStore.getState().set("minWordDuration", 0.2);
    useAudioStore.setState({ currentTime: 99, duration: 10 });
    useProjectStore.setState({ lines: [flushPairLine()] });
    useTimelineStore.setState({ rollingEditMode: false });
    selectWordAt("l1", 1);
    const screen = await render(<TimelineInfoPanel />);

    await screen.getByRole("button", { name: /Set Begin/ }).click();

    await expect.poll(() => currentWords()[1].begin).toBeCloseTo(1.8, 10);
  });

  it("clamps Set End with the configured minimum word duration", async () => {
    useSettingsStore.getState().set("minWordDuration", 0.2);
    useAudioStore.setState({ currentTime: 0, duration: 10 });
    useProjectStore.setState({ lines: [flushPairLine()] });
    useTimelineStore.setState({ rollingEditMode: false });
    selectWordAt("l1", 1);
    const screen = await render(<TimelineInfoPanel />);

    await screen.getByRole("button", { name: /Set End/ }).click();

    await expect.poll(() => currentWords()[1].end).toBeCloseTo(1.2, 10);
  });
});

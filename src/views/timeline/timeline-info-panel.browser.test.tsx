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

describe("TimelineInfoPanel selected word label", () => {
  function lineWithBackground(backgroundWordText: string) {
    return createLine({
      id: "l1",
      text: "Hello there",
      words: [createWord({ text: "Hello there", begin: 1, end: 3 })],
      backgroundText: backgroundWordText,
      backgroundWords: [createWord({ text: backgroundWordText, begin: 3, end: 4 })],
      backgroundTextSource: "manual",
    });
  }

  it("regression: shows a bracketed background word once, as stored", async () => {
    useAudioStore.setState({ duration: 10 });
    useProjectStore.setState({ lines: [lineWithBackground("(yeah)")] });
    useTimelineStore.setState({ selectedWords: [{ lineId: "l1", lineIndex: 0, wordIndex: 0, type: "bg" }] });
    const screen = await render(<TimelineInfoPanel />);
    await expect.element(screen.getByText("(yeah)", { exact: true })).toBeInTheDocument();
    expect(screen.container.textContent).not.toContain("((yeah))");
  });

  it("labels a background word as background instead of inventing brackets", async () => {
    useAudioStore.setState({ duration: 10 });
    useProjectStore.setState({ lines: [lineWithBackground("yeah")] });
    useTimelineStore.setState({ selectedWords: [{ lineId: "l1", lineIndex: 0, wordIndex: 0, type: "bg" }] });
    const screen = await render(<TimelineInfoPanel />);
    await expect.element(screen.getByText("Line 1 ・ Background")).toBeInTheDocument();
    await expect.element(screen.getByText("yeah", { exact: true })).toBeInTheDocument();
  });

  it("keeps the plain line label for a main word", async () => {
    useAudioStore.setState({ duration: 10 });
    useProjectStore.setState({ lines: [lineWithBackground("(yeah)")] });
    selectWordAt("l1", 0);
    const screen = await render(<TimelineInfoPanel />);
    await expect.element(screen.getByText("Line 1", { exact: true })).toBeInTheDocument();
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

  it("moves only the selected syllable when syllables follow rolling edit and rolling edit is off", async () => {
    useAudioStore.setState({ currentTime: 1.4, duration: 10 });
    useProjectStore.setState({
      lines: [
        createLine({
          id: "l1",
          text: "ever",
          words: [createWord({ text: "ev", begin: 0, end: 1 }), createWord({ text: "er", begin: 1, end: 2 })],
        }),
      ],
    });
    useSettingsStore.setState({ syllablesFollowRolling: true });
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

describe("TimelineInfoPanel selection copy", () => {
  it("regression: uses singular 'line' for one selected line-synced row", async () => {
    useAudioStore.setState({ duration: 30 });
    useProjectStore.setState({
      lines: [
        createLine({
          id: "w",
          text: "a b",
          words: [createWord({ text: "a ", begin: 0, end: 1 }), createWord({ text: "b", begin: 1, end: 2 })],
        }),
        { id: "ls", text: "line synced", agentId: "v1", begin: 3, end: 5 },
      ],
    });
    useTimelineStore.setState({
      selectedWords: [
        { lineId: "w", lineIndex: 0, wordIndex: 0, type: "word" },
        { lineId: "w", lineIndex: 0, wordIndex: 1, type: "word" },
        { lineId: "ls", lineIndex: 1, wordIndex: 0, type: "word" },
      ],
    });
    const screen = await render(<TimelineInfoPanel />);
    await expect.poll(() => screen.container.textContent ?? "").toContain("selected");
    expect(screen.container.textContent).toContain("2 words, 1 line selected");
  });
});

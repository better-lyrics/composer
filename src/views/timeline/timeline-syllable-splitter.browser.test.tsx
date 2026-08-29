import type { LyricLine } from "@/domain/line/model";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { TimelineSyllableSplitter } from "@/views/timeline/timeline-syllable-splitter";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("TimelineSyllableSplitter", () => {
  beforeEach(() => useAudioStore.getState().reset());

  it("renders nothing initially (no target word selected)", async () => {
    await render(<TimelineSyllableSplitter />);
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("ignores the split-syllable event when no word is selected", async () => {
    await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-syllable"));
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("opens the split dialog when the split-syllable event fires for a selected multi-char word", async () => {
    const line = createLine({ words: [createWord({ text: "hello", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" }],
    });
    const screen = await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-syllable"));
    await expect.element(screen.getByRole("heading", { name: /Split "hello"/ })).toBeInTheDocument();
  });

  it("ignores the event for single-character words", async () => {
    const line = createLine({ words: [createWord({ text: "a", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" }],
    });
    await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-syllable"));
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("stamps a fresh syllableGroupId on every new syllable when splitting a word with no id", async () => {
    const line = createLine({ words: [createWord({ text: "every", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" }],
    });
    const screen = await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-syllable"));
    await expect.element(screen.getByRole("heading", { name: /Split "every"/ })).toBeInTheDocument();

    await vi.waitFor(() => {
      const btns = document.querySelectorAll<HTMLButtonElement>("button.w-4.h-8");
      expect(btns.length).toBeGreaterThan(0);
    });
    const splitButtons = document.querySelectorAll<HTMLButtonElement>("button.w-4.h-8");
    expect(splitButtons.length).toBe(4);
    splitButtons[1].click();
    splitButtons[3].click();

    await screen.getByRole("button", { name: "Split Word" }).click();

    await vi.waitFor(() => {
      const words = useProjectStore.getState().lines[0].words ?? [];
      expect(words.map((w) => w.text)).toEqual(["ev", "er", "y"]);
    });
    const wordsAfter = useProjectStore.getState().lines[0].words ?? [];
    const ids = wordsAfter.map((w) => w.syllableGroupId);
    expect(ids[0]).toBeDefined();
    expect(ids[0]).toBe(ids[1]);
    expect(ids[1]).toBe(ids[2]);
  });

  it("preserves the source word's syllableGroupId on re-split (further-split a syllable)", async () => {
    const line = createLine({
      words: [
        createWord({ text: "ev", begin: 0, end: 0.3, syllableGroupId: "g_source" }),
        createWord({ text: "er", begin: 0.3, end: 0.6, syllableGroupId: "g_source" }),
        createWord({ text: "y", begin: 0.6, end: 1, syllableGroupId: "g_source" }),
      ],
    });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" }],
    });
    const screen = await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-syllable"));
    await expect.element(screen.getByRole("heading", { name: /Split "ev"/ })).toBeInTheDocument();

    await vi.waitFor(() => {
      const btns = document.querySelectorAll<HTMLButtonElement>("button.w-4.h-8");
      expect(btns.length).toBeGreaterThan(0);
    });
    const splitButtons = document.querySelectorAll<HTMLButtonElement>("button.w-4.h-8");
    expect(splitButtons.length).toBe(1);
    splitButtons[0].click();

    await screen.getByRole("button", { name: "Split Word" }).click();

    await vi.waitFor(() => {
      const words = useProjectStore.getState().lines[0].words ?? [];
      expect(words.length).toBe(4);
    });
    const wordsAfter = useProjectStore.getState().lines[0].words ?? [];
    expect(wordsAfter.every((w) => w.syllableGroupId === "g_source")).toBe(true);
  });

  it("opens with a word-split title and splits into independent words", async () => {
    const line = createLine({ words: [createWord({ text: "hello", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" }],
    });
    const screen = await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-word"));
    await expect.element(screen.getByRole("heading", { name: /Split "hello" into words/ })).toBeInTheDocument();

    await vi.waitFor(() => {
      const btns = document.querySelectorAll<HTMLButtonElement>("button.w-4.h-8");
      expect(btns.length).toBeGreaterThan(0);
    });
    const splitButtons = document.querySelectorAll<HTMLButtonElement>("button.w-4.h-8");
    expect(splitButtons.length).toBe(4);
    splitButtons[2].click();

    await screen.getByRole("button", { name: "Split Word" }).click();

    await vi.waitFor(() => {
      const words = useProjectStore.getState().lines[0].words ?? [];
      expect(words.length).toBe(2);
    });
    const wordsAfter = useProjectStore.getState().lines[0].words ?? [];
    expect(wordsAfter.map((w) => w.text)).toEqual(["hel ", "lo"]);
    expect(wordsAfter.every((w) => w.syllableGroupId === undefined)).toBe(true);
  });

  it("ignores the split-word event for single-character words", async () => {
    const line = createLine({ words: [createWord({ text: "a", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" }],
    });
    await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-word"));
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("hides apply-to-all controls in word-split mode", async () => {
    const line = createLine({ words: [createWord({ text: "hello", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" }],
    });
    const screen = await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-word"));
    await expect.element(screen.getByRole("heading", { name: /Split "hello" into words/ })).toBeInTheDocument();

    expect(document.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it("reconciles line.text from the new words array after a split", async () => {
    const line = createLine({
      text: "every",
      words: [createWord({ text: "every", begin: 0, end: 1 })],
    });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" }],
    });
    const screen = await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-syllable"));
    await expect.element(screen.getByRole("heading", { name: /Split "every"/ })).toBeInTheDocument();

    await vi.waitFor(() => {
      const btns = document.querySelectorAll<HTMLButtonElement>("button.w-4.h-8");
      expect(btns.length).toBeGreaterThan(0);
    });
    const splitButtons = document.querySelectorAll<HTMLButtonElement>("button.w-4.h-8");
    splitButtons[1].click();
    splitButtons[3].click();

    await screen.getByRole("button", { name: "Split Word" }).click();

    await vi.waitFor(() => {
      const words = useProjectStore.getState().lines[0].words ?? [];
      expect(words.length).toBe(3);
    });
    const lineAfter = useProjectStore.getState().lines[0];
    // text is reconciled via reconstructLineText: the split char marks the
    // syllable joints so line.text tokenizes 1:1 back to line.words.
    expect(lineAfter.text).toBe("ev|er|y");
  });

  it("writes manually selected transliteration boundaries back to the language track", async () => {
    const line: LyricLine = {
      id: "line-transliteration-split",
      agentId: "v1",
      text: "일단은",
      words: [{ text: "일단은", begin: 0, end: 1, transliteration: "ildan eun" }],
      transliteration: {
        language: "ko-Latn",
        text: "ildan-eun",
        segments: [{ original: "일단은", transliteration: "ildan-eun" }],
        origin: "google" as const,
        sourceFingerprint: "source",
      },
    };
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" }],
    });
    const screen = await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-syllable"));

    await screen.getByRole("button", { name: "Original split point 1" }).click();
    await screen.getByRole("button", { name: "Original split point 2" }).click();
    await screen.getByRole("button", { name: "Transliteration split point 3" }).click();
    await screen.getByRole("button", { name: "Transliteration split point 1" }).click();
    await screen.getByRole("button", { name: "Split Word" }).click();

    await expect.poll(() => useProjectStore.getState().lines[0].transliteration?.text).toBe("i-ldan-eun");
    expect(useProjectStore.getState().lines[0].words?.map((word) => word.transliteration)).toEqual([
      "i",
      "ldan",
      "eun",
    ]);
  });

  it("shows an inferred transliteration split at a space as selected", async () => {
    const line: LyricLine = {
      id: "line-inferred-space-split",
      agentId: "v1",
      text: "붙어있던",
      words: [{ text: "붙어있던", transliteration: "but eoissdeon", begin: 0, end: 1 }],
    };
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" }],
    });
    const screen = await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-syllable"));
    await expect.element(screen.getByRole("heading", { name: /Split "붙어있던"/ })).toBeInTheDocument();
    await screen.getByRole("button", { name: "Original split point 1" }).click();

    await expect
      .element(screen.getByRole("button", { name: "Transliteration space boundary 4" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(document.body.textContent).not.toContain("must have the same number of segments");
  });

  it("splits a dash-delimited transliteration when the playhead sets the timing boundary", async () => {
    const line: LyricLine = {
      id: "line-dash-split",
      agentId: "v1",
      text: "to-do",
      words: [{ text: "to-do", begin: 0, end: 1, transliteration: "to do" }],
      transliteration: {
        language: "en-Latn",
        text: "to-do",
        segments: [{ original: "to-do", transliteration: "to-do" }],
        origin: "google",
        sourceFingerprint: "source",
      },
    };
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" }],
    });
    useAudioStore.getState().setCurrentTime(0.5);
    const screen = await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-syllable"));

    await screen.getByRole("button", { name: "Original dash boundary 3" }).click();
    await screen.getByRole("button", { name: "Split Word" }).click();

    await expect.poll(() => useProjectStore.getState().lines[0].words?.length).toBe(2);
    const result = useProjectStore.getState().lines[0];
    expect(result.words?.map((word) => word.transliteration)).toEqual(["to", "do"]);
    expect(result.transliteration?.text).toBe("to-do");
  });
});

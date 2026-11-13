import { beforeEach, describe, expect, it, vi } from "vitest";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { getLanguageReviewTracks } from "@/domain/language/review";
import type { LyricLine } from "@/domain/line/model";
import { lineText } from "@/domain/line/text";
import { mainTrack, roleWords, timedSyllables } from "@/domain/line/track";
import { computeSyllableGroups } from "@/domain/word/syllable-groups";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createLine, createWord, createWords } from "@/test/factories";
import { legacyLine, legacyWords } from "@/test/legacy-languages";
import { render } from "@/test/render";
import { storedWordAddress } from "@/test/word-address";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { TimelineSyllableSplitter } from "@/views/timeline/timeline-syllable-splitter";

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
      selectedWords: [storedWordAddress(line.id, 0, "word")],
    });
    const screen = await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-syllable"));
    await expect.element(screen.getByRole("heading", { name: /Split "hello"/ })).toBeInTheDocument();
  });

  it("ignores the event for single-character words", async () => {
    const line = createLine({ words: [createWord({ text: "a", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [storedWordAddress(line.id, 0, "word")],
    });
    await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-syllable"));
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("stamps a fresh syllableGroupId on every new syllable when splitting a word with no id", async () => {
    const line = createLine({ words: [createWord({ text: "every", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [storedWordAddress(line.id, 0, "word")],
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
      const words = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
      expect(words.map((w) => w.text + w.sep)).toEqual(["ev", "er", "y"]);
    });
    const wordsAfter = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
    expect(computeSyllableGroups(wordsAfter)).toMatchObject([{ startIndex: 0, endIndex: 2 }]);
  });

  it("keeps the source word's group on re-split (further-split a syllable)", async () => {
    const line = createLine({
      words: createWords([
        { text: "ev", begin: 0, end: 0.3, syllableGroupId: "g_source" },
        { text: "er", begin: 0.3, end: 0.6, syllableGroupId: "g_source" },
        { text: "y", begin: 0.6, end: 1, syllableGroupId: "g_source" },
      ]),
    });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [storedWordAddress(line.id, 0, "word")],
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
      const words = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
      expect(words.length).toBe(4);
    });
    const wordsAfter = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
    expect(computeSyllableGroups(wordsAfter)).toMatchObject([{ startIndex: 0, endIndex: 3 }]);
  });

  it("opens with a word-split title and splits into independent words", async () => {
    const line = createLine({ words: [createWord({ text: "hello", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [storedWordAddress(line.id, 0, "word")],
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
      const words = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
      expect(words.length).toBe(2);
    });
    const wordsAfter = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
    expect(wordsAfter.map((w) => w.text + w.sep)).toEqual(["hel ", "lo"]);
    expect(computeSyllableGroups(wordsAfter)).toEqual([]);
  });

  it("ignores the split-word event for single-character words", async () => {
    const line = createLine({ words: [createWord({ text: "a", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [storedWordAddress(line.id, 0, "word")],
    });
    await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-word"));
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("hides apply-to-all controls in word-split mode", async () => {
    const line = createLine({ words: [createWord({ text: "hello", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [storedWordAddress(line.id, 0, "word")],
    });
    const screen = await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-word"));
    await expect.element(screen.getByRole("heading", { name: /Split "hello" into words/ })).toBeInTheDocument();

    expect(document.querySelector('input[type="checkbox"]')).toBeNull();
  });

  describe("regressions", () => {
    it("regression: opens the split-word dialog for a line-synced line with no words array", async () => {
      const line = createLine({ text: "It hurts for me", begin: 107.9, end: 110.4 });
      useProjectStore.setState({ lines: [line] });
      useTimelineStore.setState({
        selectedWords: [storedWordAddress(line.id, 0, "word")],
      });
      const screen = await render(<TimelineSyllableSplitter />);
      window.dispatchEvent(new Event("timeline:split-word"));
      await expect
        .element(screen.getByRole("heading", { name: /Split "It hurts for me" into words/ }))
        .toBeInTheDocument();
    });

    it("regression: splitting a line-synced line writes word timing inside the line bounds", async () => {
      const line = createLine({ text: "It hurts", begin: 10, end: 12 });
      useProjectStore.setState({ lines: [line] });
      useTimelineStore.setState({
        selectedWords: [storedWordAddress(line.id, 0, "word")],
      });
      const screen = await render(<TimelineSyllableSplitter />);
      window.dispatchEvent(new Event("timeline:split-word"));
      await expect.element(screen.getByRole("heading", { name: /Split "It hurts" into words/ })).toBeInTheDocument();

      await screen.getByRole("button", { name: "Text pronunciation break 3" }).click();
      await screen.getByRole("button", { name: "Split Word" }).click();

      await vi.waitFor(() => {
        expect(roleWords(useProjectStore.getState().lines[0], "main")?.length).toBe(2);
      });
      const after = useProjectStore.getState().lines[0];
      expect(timedSyllables(mainTrack(after)).map((w) => w.text.trim())).toEqual(["It", "hurts"]);
      expect(timedSyllables(mainTrack(after))[0].begin).toBe(10);
      expect(timedSyllables(mainTrack(after))[1].end).toBe(12);
      expect(mainTrack(after).begin).toBeUndefined();
      expect(mainTrack(after).end).toBeUndefined();
    });

    it("regression: opens the split-syllable dialog for a line-synced line with no words array", async () => {
      const line = createLine({ text: "forever", begin: 1, end: 2 });
      useProjectStore.setState({ lines: [line] });
      useTimelineStore.setState({
        selectedWords: [storedWordAddress(line.id, 0, "word")],
      });
      const screen = await render(<TimelineSyllableSplitter />);
      window.dispatchEvent(new Event("timeline:split-syllable"));
      await expect.element(screen.getByRole("heading", { name: /Split "forever"/ })).toBeInTheDocument();
    });

    it("regression: ignores the split-word event for an untimed line", async () => {
      const line = createLine({ text: "no timing here" });
      useProjectStore.setState({ lines: [line] });
      useTimelineStore.setState({
        selectedWords: [storedWordAddress(line.id, 0, "word")],
      });
      await render(<TimelineSyllableSplitter />);
      window.dispatchEvent(new Event("timeline:split-word"));
      expect(document.querySelector("dialog")).toBeNull();
    });
  });

  it("reconciles line.text from the new words array after a split", async () => {
    const line = createLine({
      text: "every",
      words: [createWord({ text: "every", begin: 0, end: 1 })],
    });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [storedWordAddress(line.id, 0, "word")],
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
      const words = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
      expect(words.length).toBe(3);
    });
    const lineAfter = useProjectStore.getState().lines[0];
    // text is reconciled via reconstructLineText: the split char marks the
    // syllable joints so line.text tokenizes 1:1 back to line.words.
    expect(lineText(lineAfter)).toBe("ev|er|y");
  });

  it("writes manually selected transliteration boundaries back to the language track", async () => {
    const line: LyricLine = legacyLine({
      id: "line-transliteration-split",
      agentId: "v1",
      text: "일단은",
      words: [{ id: "w1", text: "일단은", sep: "", begin: 0, end: 1, transliteration: "ildan eun", joinsNext: false }],
      transliteration: {
        language: "ko-Latn",
        text: "ildan eun",
        segments: [{ original: "일단은", transliteration: "ildan eun" }],
        origin: "google" as const,
        sourceFingerprint: "source",
      },
    });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [storedWordAddress(line.id, 0, "word")],
    });
    const screen = await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-syllable"));

    await screen.getByRole("button", { name: "Original split point 1" }).click();
    await screen.getByRole("button", { name: "Original split point 2" }).click();
    await screen.getByRole("button", { name: "Transliteration split point 3" }).click();
    await screen.getByRole("button", { name: "Transliteration split point 1" }).click();
    await screen.getByRole("button", { name: "Split Word" }).click();

    await expect.poll(() => roleWords(useProjectStore.getState().lines[0], "main")?.length).toBe(3);
    const saved = useProjectStore.getState().lines[0];
    expect(saved.languages?.transliteration?.main.text).toBe("ildan eun");
    expect(
      (legacyWords(timedSyllables(mainTrack(saved)), saved.languages) ?? []).map((word) => word.transliteration),
    ).toEqual(["i", "ldan", "eun"]);
    expect(
      (legacyWords(timedSyllables(mainTrack(saved)), saved.languages) ?? []).map(
        (word) => word.transliterationJoinerAfter,
      ),
    ).toEqual(["", " ", undefined]);
  });

  it("re-stamps a manual transliteration after a word split", async () => {
    const line: LyricLine = legacyLine({
      id: "line-word-split",
      agentId: "v1",
      text: "хорошо",
      words: [{ id: "w2", text: "хорошо", sep: "", begin: 0, end: 1, joinsNext: false }],
      transliteration: {
        language: "ru-Latn",
        text: "khorosho",
        segments: [],
        origin: "manual",
        sourceFingerprint: languageSourceFingerprint("хорошо"),
      },
    });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [storedWordAddress(line.id, 0, "word")],
    });
    const screen = await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-word"));

    await screen.getByRole("button", { name: "Original split point 3" }).click();
    await screen.getByRole("button", { name: "Split Word" }).click();

    await expect.poll(() => roleWords(useProjectStore.getState().lines[0], "main")?.length).toBe(2);
    const saved = useProjectStore.getState().lines[0];
    expect(lineText(saved)).toBe("хор ошо");
    expect(saved.languages?.transliteration?.main.text).toBe("khorosho");
    expect(saved.languages?.transliteration?.sourceFingerprint).toBe(languageSourceFingerprint("хор ошо"));
    expect(getLanguageReviewTracks(saved)).toEqual([]);
  });

  it("keeps a literal transliteration dash when splitting into words at it", async () => {
    const line: LyricLine = legacyLine({
      id: "line-dash-word-split",
      agentId: "v1",
      text: "to-do",
      words: [{ id: "w3", text: "to-do", sep: "", begin: 0, end: 1, transliteration: "to-do", joinsNext: false }],
      transliteration: {
        language: "en-Latn",
        text: "to-do",
        segments: [],
        origin: "manual",
        sourceFingerprint: languageSourceFingerprint("to-do"),
      },
    });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [storedWordAddress(line.id, 0, "word")],
    });
    const screen = await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-word"));

    await screen.getByRole("button", { name: "Original dash 3" }).click();
    await screen.getByRole("button", { name: "Split Word" }).click();

    await expect.poll(() => roleWords(useProjectStore.getState().lines[0], "main")?.length).toBe(2);
    const saved = useProjectStore.getState().lines[0];
    expect(saved.languages?.transliteration?.main.text).toBe("to-do");
    expect(getLanguageReviewTracks(saved)).toEqual([]);
  });

  it("preserves a literal transliteration dash when the playhead sets the timing boundary", async () => {
    const line: LyricLine = legacyLine({
      id: "line-dash-split",
      agentId: "v1",
      text: "to-do",
      words: [{ id: "w4", text: "to-do", sep: "", begin: 0, end: 1, transliteration: "to-do", joinsNext: false }],
      transliteration: {
        language: "en-Latn",
        text: "to-do",
        segments: [{ original: "to-do", transliteration: "to-do" }],
        origin: "google",
        sourceFingerprint: "source",
      },
    });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      selectedWords: [storedWordAddress(line.id, 0, "word")],
    });
    useAudioStore.getState().setCurrentTime(0.5);
    const screen = await render(<TimelineSyllableSplitter />);
    window.dispatchEvent(new Event("timeline:split-syllable"));

    await screen.getByRole("button", { name: "Original dash 3" }).click();
    await screen.getByRole("button", { name: "Split Word" }).click();

    await expect.poll(() => roleWords(useProjectStore.getState().lines[0], "main")?.length).toBe(2);
    const result = useProjectStore.getState().lines[0];
    expect(
      (legacyWords(timedSyllables(mainTrack(result)), result.languages) ?? []).map((word) => word.transliteration),
    ).toEqual(["to", "do"]);
    expect(result.languages?.transliteration?.main.text).toBe("to-do");
  });
});

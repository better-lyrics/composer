import { describe, expect, it } from "vitest";
import { setBackground } from "@/domain/line/background";
import { bgBounds, mainBounds } from "@/domain/line/bounds";
import { reconcileLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import { bgSource, bgText, bgVoice, bgWords, mainWords } from "@/domain/line/voices";
import { isWordSynced as isVoiceWordSynced } from "@/domain/voice/predicates";
import { TimelineContextMenu } from "@/views/timeline/timeline-context-menu";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useAudioStore } from "@/stores/audio";
import { useConfirmStore } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";

function findButton(pattern: RegExp): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll("button")).find((b) => pattern.test(b.textContent ?? ""));
}

function openWordContextMenu(lineId: string) {
  useTimelineStore.setState({
    contextMenu: {
      x: 100,
      y: 100,
      target: { kind: "word", lineId, lineIndex: 0, wordIndex: 0, type: "word" },
    },
    selectedWords: [{ lineId, lineIndex: 0, wordIndex: 0, type: "word" }],
  });
}

describe("TimelineContextMenu", () => {
  it("renders nothing when no context menu is set", async () => {
    useTimelineStore.setState({ contextMenu: null });
    await render(<TimelineContextMenu />);
    const explicitButton = Array.from(document.querySelectorAll("button")).find((b) =>
      /explicit/i.test(b.textContent ?? ""),
    );
    expect(explicitButton).toBeUndefined();
  });

  it("opens the menu when contextMenu state is set", async () => {
    const line = createLine({ words: [createWord({ text: "hi", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    openWordContextMenu(line.id);
    await render(<TimelineContextMenu />);
    expect(document.querySelectorAll("button").length).toBeGreaterThan(0);
  });

  it("dismisses the menu when an outside click occurs", async () => {
    const line = createLine({ words: [createWord({ text: "hi", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    openWordContextMenu(line.id);
    await render(<TimelineContextMenu />);
    expect(useTimelineStore.getState().contextMenu).not.toBeNull();
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(useTimelineStore.getState().contextMenu).toBeNull();
  });

  it("toggles word explicit flag when the 'Mark explicit' action is invoked", async () => {
    const line = createLine({
      words: [createWord({ text: "darn", begin: 0, end: 1 })],
    });
    useProjectStore.setState({ lines: [line] });
    openWordContextMenu(line.id);
    await render(<TimelineContextMenu />);
    const explicitButton = Array.from(document.querySelectorAll("button")).find((b) =>
      /explicit/i.test(b.textContent ?? ""),
    );
    expect(explicitButton).toBeDefined();
    explicitButton?.click();
    const updated = mainWords(useProjectStore.getState().lines[0])?.[0];
    expect(updated?.explicit).toBe(true);
  });

  it("shows 'Merge syllables' on a syllable-group word and collapses the group to one word when clicked", async () => {
    const line = createLine({
      words: [
        createWord({ text: "ev", begin: 0, end: 0.3, syllableGroupId: "g_every" }),
        createWord({ text: "er", begin: 0.3, end: 0.6, syllableGroupId: "g_every" }),
        createWord({ text: "y", begin: 0.6, end: 1, syllableGroupId: "g_every" }),
      ],
    });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      contextMenu: {
        x: 100,
        y: 100,
        target: { kind: "word", lineId: line.id, lineIndex: 0, wordIndex: 1, type: "word" },
      },
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 1, type: "word" }],
    });
    await render(<TimelineContextMenu />);

    const mergeBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      /Merge syllables/i.test(b.textContent ?? ""),
    );
    expect(mergeBtn).toBeDefined();
    mergeBtn?.click();

    const words = mainWords(useProjectStore.getState().lines[0]) ?? [];
    expect(words).toHaveLength(1);
    expect(words[0].text).toBe("every");
    expect(words[0].begin).toBe(0);
    expect(words[0].end).toBe(1);
    expect(words[0].syllableGroupId).toBeUndefined();
  });

  it("hides 'Merge syllables' on a standalone word", async () => {
    const line = createLine({ words: [createWord({ text: "hello", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      contextMenu: {
        x: 100,
        y: 100,
        target: { kind: "word", lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" },
      },
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 0, type: "word" }],
    });
    await render(<TimelineContextMenu />);

    const mergeBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      /Merge syllables/i.test(b.textContent ?? ""),
    );
    expect(mergeBtn).toBeUndefined();
  });

  it("shows 'Split word' on a word target and dispatches timeline:split-word when clicked", async () => {
    const line = createLine({ words: [createWord({ text: "hello", begin: 0, end: 1 })] });
    useProjectStore.setState({ lines: [line] });
    openWordContextMenu(line.id);
    await render(<TimelineContextMenu />);

    const splitWordBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.trim().startsWith("Split word"),
    );
    expect(splitWordBtn).toBeDefined();

    let dispatched = false;
    const onSplitWord = () => {
      dispatched = true;
    };
    window.addEventListener("timeline:split-word", onSplitWord);
    splitWordBtn?.click();
    window.removeEventListener("timeline:split-word", onSplitWord);

    expect(dispatched).toBe(true);
  });

  it("snaps a gapped syllable group flush when 'Snap syllables flush' is clicked", async () => {
    const line = createLine({
      words: [
        createWord({ text: "beau", begin: 0, end: 0.3, syllableGroupId: "g_beau" }),
        createWord({ text: "ti", begin: 0.5, end: 0.8, syllableGroupId: "g_beau" }),
        createWord({ text: "ful", begin: 1.0, end: 1.3, syllableGroupId: "g_beau" }),
      ],
    });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      contextMenu: {
        x: 100,
        y: 100,
        target: { kind: "word", lineId: line.id, lineIndex: 0, wordIndex: 1, type: "word" },
      },
      selectedWords: [{ lineId: line.id, lineIndex: 0, wordIndex: 1, type: "word" }],
    });
    await render(<TimelineContextMenu />);

    const snapBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      /Snap syllables flush/i.test(b.textContent ?? ""),
    );
    expect(snapBtn).toBeDefined();
    snapBtn?.click();

    const words = mainWords(useProjectStore.getState().lines[0]) ?? [];
    expect(words[0].end).toBe(words[1].begin);
    expect(words[1].end).toBe(words[2].begin);
    expect(words[0].begin).toBe(0);
    expect(words[2].end).toBe(1.3);
  });
});

describe("TimelineContextMenu background provenance", () => {
  function bgLine() {
    return createLine({
      id: "l1",
      text: "main",
      words: [createWord({ text: "main", begin: 0, end: 1 })],
      backgroundText: "ooh aah",
      backgroundWords: [
        createWord({ text: "ooh ", begin: 1, end: 1.5 }),
        createWord({ text: "aah", begin: 1.5, end: 2 }),
      ],
      backgroundTextSource: "extraction",
    });
  }

  it("stamps backgroundTextSource manual when a bg word is deleted but others remain", async () => {
    useProjectStore.setState({ lines: [bgLine()] });
    useTimelineStore.setState({
      contextMenu: {
        x: 100,
        y: 100,
        target: { kind: "word", lineId: "l1", lineIndex: 0, wordIndex: 0, type: "bg" },
      },
      selectedWords: [{ lineId: "l1", lineIndex: 0, wordIndex: 0, type: "bg" }],
    });
    await render(<TimelineContextMenu />);

    findButton(/Delete word/i)?.click();

    const updated = useProjectStore.getState().lines[0];
    expect(bgWords(updated)?.map((w) => w.text)).toEqual(["aah"]);
    expect(bgSource(updated)).toBe("manual");
  });

  it("clears all three background fields when the last bg word is deleted", async () => {
    const single = createLine({
      id: "l1",
      text: "main",
      words: [createWord({ text: "main", begin: 0, end: 1 })],
      backgroundText: "ooh",
      backgroundWords: [createWord({ text: "ooh", begin: 1, end: 2 })],
      backgroundTextSource: "extraction",
    });
    useProjectStore.setState({ lines: [single] });
    useTimelineStore.setState({
      contextMenu: {
        x: 100,
        y: 100,
        target: { kind: "word", lineId: "l1", lineIndex: 0, wordIndex: 0, type: "bg" },
      },
      selectedWords: [{ lineId: "l1", lineIndex: 0, wordIndex: 0, type: "bg" }],
    });
    await render(<TimelineContextMenu />);

    findButton(/Delete word/i)?.click();

    const updated = useProjectStore.getState().lines[0];
    expect(bgWords(updated)).toBeUndefined();
    expect(bgText(updated)).toBeUndefined();
    expect(bgSource(updated)).toBeUndefined();
  });

  it("stamps backgroundTextSource manual when a bg word is added via 'Add word here'", async () => {
    useAudioStore.setState({ duration: 10 });
    useProjectStore.setState({ lines: [bgLine()] });
    useTimelineStore.setState({
      contextMenu: {
        x: 100,
        y: 100,
        target: { kind: "track", lineId: "l1", lineIndex: 0, time: 5, type: "bg" },
      },
    });
    await render(<TimelineContextMenu />);

    findButton(/Add word here/i)?.click();

    const updated = useProjectStore.getState().lines[0];
    expect(bgWords(updated)?.length).toBe(3);
    expect(bgSource(updated)).toBe("manual");
  });

  it("stamps backgroundTextSource manual when bg words are merged", async () => {
    useProjectStore.setState({ lines: [bgLine()] });
    useTimelineStore.setState({
      contextMenu: {
        x: 100,
        y: 100,
        target: { kind: "word", lineId: "l1", lineIndex: 0, wordIndex: 0, type: "bg" },
      },
      selectedWords: [
        { lineId: "l1", lineIndex: 0, wordIndex: 0, type: "bg" },
        { lineId: "l1", lineIndex: 0, wordIndex: 1, type: "bg" },
      ],
    });
    await render(<TimelineContextMenu />);

    findButton(/Merge words/i)?.click();

    const updated = useProjectStore.getState().lines[0];
    expect(bgWords(updated)).toHaveLength(1);
    expect(bgSource(updated)).toBe("manual");
  });

  it("leaves background provenance untouched when a main word is deleted", async () => {
    const line = createLine({
      id: "l1",
      text: "I love",
      words: [createWord({ text: "I ", begin: 0, end: 0.5 }), createWord({ text: "love", begin: 0.5, end: 1 })],
      backgroundText: "ooh",
      backgroundWords: [createWord({ text: "ooh", begin: 1, end: 2 })],
      backgroundTextSource: "extraction",
    });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      contextMenu: {
        x: 100,
        y: 100,
        target: { kind: "word", lineId: "l1", lineIndex: 0, wordIndex: 0, type: "word" },
      },
      selectedWords: [{ lineId: "l1", lineIndex: 0, wordIndex: 0, type: "word" }],
    });
    await render(<TimelineContextMenu />);

    findButton(/Delete word/i)?.click();

    expect(bgSource(useProjectStore.getState().lines[0])).toBe("extraction");
  });
});

// -- Voice-aware placement ----------------------------------------------------

function openTrackContextMenu(lineId: string, type: "word" | "bg", time: number) {
  useTimelineStore.setState({
    contextMenu: { x: 100, y: 100, target: { kind: "track", lineId, lineIndex: 0, time, type } },
    selectedWords: [],
  });
}

describe("TimelineContextMenu · Place line here (main track only)", () => {
  it("shows 'Place line here' on the main track for an untimed line", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "verse" })] });
    openTrackContextMenu("l1", "word", 5);
    await render(<TimelineContextMenu />);
    expect(findButton(/Place line here/i)).toBeDefined();
  });

  it("hides 'Place line here' on the bg track even when the main is placeable", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "verse" })] });
    openTrackContextMenu("l1", "bg", 5);
    await render(<TimelineContextMenu />);
    expect(findButton(/Place line here/i)).toBeUndefined();
  });
});

describe("TimelineContextMenu · Place background here (bg track only)", () => {
  it("shows 'Place background here' on the bg track for an untimed bg", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "verse", backgroundText: "ooh ooh" })] });
    openTrackContextMenu("l1", "bg", 5);
    await render(<TimelineContextMenu />);
    expect(findButton(/Place background here/i)).toBeDefined();
  });

  it("hides 'Place background here' on the main track", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "verse", backgroundText: "ooh ooh" })] });
    openTrackContextMenu("l1", "word", 5);
    await render(<TimelineContextMenu />);
    expect(findButton(/Place background here/i)).toBeUndefined();
  });

  it("hides 'Place background here' when the line has no bg text", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "verse" })] });
    openTrackContextMenu("l1", "bg", 5);
    await render(<TimelineContextMenu />);
    expect(findButton(/Place background here/i)).toBeUndefined();
  });

  it("hides 'Place background here' when the bg is already word-synced", async () => {
    useProjectStore.setState({
      lines: [
        createLine({
          id: "l1",
          text: "verse",
          backgroundText: "ooh aah",
          backgroundWords: [
            createWord({ text: "ooh ", begin: 1, end: 1.5 }),
            createWord({ text: "aah", begin: 1.5, end: 2 }),
          ],
          backgroundTextSource: "extraction",
        }),
      ],
    });
    openTrackContextMenu("l1", "bg", 5);
    await render(<TimelineContextMenu />);
    expect(findButton(/Place background here/i)).toBeUndefined();
  });

  it("hides 'Place background here' when the bg is already line-synced", async () => {
    const line = createLine({ id: "l1", text: "verse", begin: 0, end: 4 });
    useProjectStore.setState({ lines: [line] });
    useProjectStore.getState().applyLineBackground("l1", { text: "ooh", source: "manual" });
    expect(bgBounds(useProjectStore.getState().lines[0])).not.toBeNull();
    openTrackContextMenu("l1", "bg", 5);
    await render(<TimelineContextMenu />);
    expect(findButton(/Place background here/i)).toBeUndefined();
  });

  it("line-syncs the bg at the clicked time and leaves the main untouched when clicked", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "verse line", backgroundText: "ooh ooh" })] });
    openTrackContextMenu("l1", "bg", 5);
    await render(<TimelineContextMenu />);

    findButton(/Place background here/i)?.click();

    const updated = useProjectStore.getState().lines[0];
    expect(bgWords(updated)).toBeUndefined();
    expect(bgBounds(updated)).toEqual({ begin: 5, end: 5 + 2 * 0.3 });
    expect(mainBounds(updated)).toBeNull();
    expect(mainWords(updated)).toBeUndefined();
  });
});

// -- Voice-aware split into words ---------------------------------------------

function openWordTarget(lineId: string, type: "word" | "bg") {
  useTimelineStore.setState({
    contextMenu: { x: 100, y: 100, target: { kind: "word", lineId, lineIndex: 0, wordIndex: 0, type } },
    selectedWords: [{ lineId, lineIndex: 0, wordIndex: 0, type }],
  });
}

describe("TimelineContextMenu · Split into words (voice-aware)", () => {
  it("labels the main voice action 'Split into words'", async () => {
    useProjectStore.setState({
      lines: [reconcileLine({ id: "l1", text: "one two", agentId: "v1", begin: 1, end: 3 })],
    });
    openWordTarget("l1", "word");
    await render(<TimelineContextMenu />);
    expect(findButton(/Split into words/)).toBeDefined();
    expect(findButton(/Split background into words/)).toBeUndefined();
  });

  it("labels the bg voice action 'Split background into words'", async () => {
    const main = reconcileLine({ id: "l1", text: "lead", agentId: "v1", words: [{ text: "lead", begin: 0, end: 2 }] });
    const raw = setBackground(main, { text: "ooh ooh", begin: 3, end: 5, source: "manual" });
    useProjectStore.setState({ lines: [raw] });
    openWordTarget("l1", "bg");
    await render(<TimelineContextMenu />);
    expect(findButton(/Split background into words/)).toBeDefined();
    expect(findButton(/Split into words/)).toBeUndefined();
  });

  it("splits the line-synced bg into words and leaves the main untouched when clicked", async () => {
    const main = reconcileLine({
      id: "l1",
      text: "lead",
      agentId: "v1",
      words: [{ text: "lead", begin: 0, end: 2 }],
    });
    const raw = setBackground(main, { text: "ooh ooh ooh", begin: 3, end: 6, source: "manual" });
    useProjectStore.setState({ lines: [raw] });
    openWordTarget("l1", "bg");
    await render(<TimelineContextMenu />);

    findButton(/Split background into words/)?.click();

    const updated = useProjectStore.getState().lines[0];
    const bg = bgVoice(updated);
    expect(bg).not.toBeNull();
    expect(isVoiceWordSynced(bg!)).toBe(true);
    expect(bgWords(updated)?.length).toBe(3);
    expect(bgBounds(updated)).toEqual({ begin: 3, end: 6 });
    expect(mainWords(updated)).toEqual([{ text: "lead", begin: 0, end: 2 }]);
  });

  it("splits the line-synced main into words when the main action is clicked", async () => {
    useProjectStore.setState({
      lines: [reconcileLine({ id: "l1", text: "one two three", agentId: "v1", begin: 1, end: 4 })],
    });
    openWordTarget("l1", "word");
    await render(<TimelineContextMenu />);

    findButton(/Split into words/)?.click();

    const updated = useProjectStore.getState().lines[0];
    expect(isLineSynced(updated)).toBe(false);
    expect(mainWords(updated)?.length).toBe(3);
  });
});

// -- Remove background (gutter only) ------------------------------------------

function openGutterContextMenu(lineId: string) {
  useTimelineStore.setState({
    contextMenu: { x: 100, y: 100, target: { kind: "gutter", lineId, lineIndex: 0 } },
    selectedWords: [],
  });
}

describe("TimelineContextMenu · Remove background (gutter only)", () => {
  it("shows 'Remove background' on the gutter for a line with a bg", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "verse", backgroundText: "ooh" })] });
    openGutterContextMenu("l1");
    await render(<TimelineContextMenu />);
    expect(findButton(/Remove background/i)).toBeDefined();
  });

  it("hides 'Remove background' on the gutter for a line with no bg", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "verse" })] });
    openGutterContextMenu("l1");
    await render(<TimelineContextMenu />);
    expect(findButton(/Remove background/i)).toBeUndefined();
  });

  it("hides 'Remove background' on a word target even when the line has a bg", async () => {
    useProjectStore.setState({
      lines: [
        createLine({
          id: "l1",
          text: "verse",
          words: [createWord({ text: "verse", begin: 0, end: 1 })],
          backgroundText: "ooh",
        }),
      ],
    });
    openWordContextMenu("l1");
    await render(<TimelineContextMenu />);
    expect(findButton(/Remove background/i)).toBeUndefined();
  });

  it("opens the confirm on click and clears the bg when accepted", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "verse", backgroundText: "ooh" })] });
    openGutterContextMenu("l1");
    await render(<TimelineContextMenu />);

    findButton(/Remove background/i)?.click();
    expect(useConfirmStore.getState().isOpen).toBe(true);

    useConfirmStore.getState().resolveAndClose(true, false);

    await expect.poll(() => bgVoice(useProjectStore.getState().lines[0])).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { LineRow } from "@/views/timeline/line-row";
import { setBackground } from "@/domain/line/background";
import { bgBounds, mainBounds } from "@/domain/line/bounds";
import { getEffectiveLines } from "@/domain/line/effective-words";
import { reconcileLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/voice/predicates";
import { bgSource, bgText, bgVoice, bgWords, lineText } from "@/domain/line/voices";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";

describe("LineRow", () => {
  it("renders one word block per word on a synced line", async () => {
    const line = createLine({
      words: [createWord({ text: "hello ", begin: 0, end: 1 }), createWord({ text: "world", begin: 1, end: 2 })],
    });
    useProjectStore.setState({ lines: [line] });
    const screen = await render(
      <LineRow line={line} lineIndex={0} duration={5} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
      { dndContext: true },
    );
    expect(screen.container.querySelectorAll("[data-word-block]").length).toBe(2);
  });

  it("renders the agent gutter with the line's color", async () => {
    const line = createLine();
    useProjectStore.setState({ lines: [line] });
    const screen = await render(
      <LineRow line={line} lineIndex={0} duration={5} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
      { dndContext: true },
    );
    expect(screen.container.querySelector(".sticky.left-0")).not.toBeNull();
  });

  it("places an unsynced line at the audio's current time when the Place button is clicked", async () => {
    useAudioStore.setState({ currentTime: 5 });
    const line = createLine({ text: "hello world" });
    useProjectStore.setState({ lines: [line] });
    const screen = await render(
      <LineRow line={line} lineIndex={0} duration={30} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
      { dndContext: true },
    );
    const placeButton = Array.from(screen.container.querySelectorAll("button")).find((b) => b.textContent === "Place");
    expect(placeButton).toBeDefined();
    placeButton?.click();
    const updated = useProjectStore.getState().lines.find((l) => l.id === line.id);
    expect(updated && mainBounds(updated)?.begin).toBeCloseTo(5, 5);
    expect(((updated && mainBounds(updated)?.end) ?? 0) > 5).toBe(true);
  });

  it("does not show the Place button for a line that already has words", async () => {
    const line = createLine({
      words: [createWord({ text: "synced", begin: 0, end: 1 })],
    });
    useProjectStore.setState({ lines: [line] });
    const screen = await render(
      <LineRow line={line} lineIndex={0} duration={5} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
      { dndContext: true },
    );
    const placeButton = Array.from(screen.container.querySelectorAll("button")).find((b) => b.textContent === "Place");
    expect(placeButton).toBeUndefined();
  });

  it("uses the row height from the timeline store when one is set for this line", async () => {
    const line = createLine({
      words: [createWord({ text: "x", begin: 0, end: 1 })],
    });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState((s) => ({ rowHeights: { ...s.rowHeights, [line.id]: 64 } }));
    const screen = await render(
      <LineRow line={line} lineIndex={0} duration={5} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
      { dndContext: true },
    );
    const sized = Array.from(screen.container.querySelectorAll<HTMLElement>("[style*='height']")).find(
      (el) => el.style.height === "64px",
    );
    expect(sized).toBeDefined();
  });

  it("shifts horizontally when this line is the target of a group drag", async () => {
    const groupId = "g1";
    const line = createLine({
      words: [createWord({ text: "x", begin: 0, end: 1 })],
      groupId,
      instanceIdx: 0,
    });
    useProjectStore.setState({ lines: [line] });
    useTimelineStore.setState({
      draggedGroupShift: { groupId, instanceIdx: 0, offsetPx: 25 },
    });
    const screen = await render(
      <LineRow line={line} lineIndex={0} duration={5} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
      { dndContext: true },
    );
    const transformed = Array.from(screen.container.querySelectorAll<HTMLElement>("[style*='translateX']")).find((el) =>
      el.style.transform.includes("translateX(25"),
    );
    expect(transformed).toBeDefined();
  });

  it("renders a separate background-words track when backgroundWords are present", async () => {
    const line = createLine({
      words: [createWord({ text: "main", begin: 0, end: 1 })],
      backgroundText: "(echo)",
      backgroundWords: [createWord({ text: "(echo)", begin: 0, end: 1 })],
    });
    useProjectStore.setState({ lines: [line] });
    const screen = await render(
      <LineRow line={line} lineIndex={0} duration={5} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
      { dndContext: true },
    );
    const wordBlocks = screen.container.querySelectorAll("[data-word-block]");
    expect(wordBlocks.length).toBe(2);
  });

  it("stamps a manual provenance when a background word is created via the drop-zone", async () => {
    useAudioStore.setState({ duration: 30 });
    const line = createLine({
      id: "l1",
      text: "hello world",
      words: [createWord({ text: "hello", begin: 0, end: 1 })],
    });
    useProjectStore.setState({ lines: [line] });
    const screen = await render(
      <LineRow line={line} lineIndex={0} duration={30} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
      { dndContext: true },
    );

    const dropZone = Array.from(screen.container.querySelectorAll("div")).find((d) => d.textContent?.trim() === "BG");
    expect(dropZone).toBeDefined();
    dropZone?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: 100 }));

    await expect.poll(() => bgWords(useProjectStore.getState().lines[0])?.length).toBe(1);
    expect(bgSource(useProjectStore.getState().lines[0])).toBe("manual");
  });

  // Regression: right-clicking the bg drop-zone on a line with no background opened
  // nothing, because the per-row group-tint overlay (an `absolute inset-0` div) is
  // positioned and paints above the *static* drop-zone, so it became the hit target
  // and swallowed the drop-zone's onContextMenu. The main lane and a word-synced bg
  // WordTrack are `relative`, so they paint above the overlay and were unaffected,
  // which is why the bug only hit no-bg lines. The overlay is decorative (its tint
  // child is already pointer-events-none); the wrapper must be too.
  //
  // We lock this structurally (the overlay declares pointer-events-none) rather than
  // behaviorally: the hit test only reproduces inside the timeline's Virtuoso layout
  // (fixed row height, so the overlay actually covers the drop-zone), and Tailwind
  // utilities are not applied in the component test harness, so getComputedStyle
  // cannot observe pointer-events here. A removed class reintroduces the bug and
  // fails this test.
  it("keeps every per-row tint overlay declaring pointer-events-none", async () => {
    const line = createLine({
      id: "l1",
      text: "hello world",
      words: [createWord({ text: "hello", begin: 0, end: 1 })],
    });
    useProjectStore.setState({ lines: [line] });

    const screen = await render(
      <LineRow line={line} lineIndex={0} duration={30} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
      { dndContext: true },
    );

    const overlays = screen.container.querySelectorAll<HTMLElement>(".absolute.inset-0");
    expect(overlays.length).toBeGreaterThan(0);
    for (const overlay of overlays) {
      expect(overlay.classList.contains("pointer-events-none")).toBe(true);
    }
  });
});

// End-to-end lock for the Task 8.1 fix at its real UI call site. The store-level
// regression hardcodes { propagateToSiblings: false }; this test drives the
// actual "Place" button in SyncLineButton, so it fails if anyone drops that
// option from the call site (which would clobber a linked sibling's background).
describe("LineRow · place line keeps linked sibling background", () => {
  function getLine(id: string) {
    const line = useProjectStore.getState().lines.find((l) => l.id === id);
    if (!line) throw new Error(`line ${id} not found`);
    return line;
  }

  it("placing an untimed line via the Place button leaves a linked sibling's background untouched", async () => {
    const placeTime = 5;
    const group = createGroup({ id: "g1" });
    const target = reconcileLine({
      id: "target",
      text: "I love you",
      agentId: "v1",
      groupId: "g1",
      instanceIdx: 0,
      templateLineIdx: 0,
    });
    const sibling = reconcileLine({
      id: "sibling",
      text: "I love you",
      agentId: "v1",
      groupId: "g1",
      instanceIdx: 1,
      templateLineIdx: 0,
      backgroundText: "ooh ooh",
      backgroundWords: [
        { text: "ooh ", begin: 20, end: 20.5 },
        { text: "ooh", begin: 20.5, end: 21 },
      ],
      backgroundTextSource: "manual",
    });
    useProjectStore.setState({ groups: [group], lines: [target, sibling] });
    useAudioStore.setState({ currentTime: placeTime });
    const siblingBgBefore = bgVoice(getLine("sibling"));
    expect(siblingBgBefore).not.toBeNull();

    const screen = await render(
      <LineRow line={target} lineIndex={0} duration={30} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
      { dndContext: true },
    );
    const placeButton = Array.from(screen.container.querySelectorAll("button")).find((b) => b.textContent === "Place");
    expect(placeButton).toBeDefined();
    placeButton?.click();

    const wordDuration = useSettingsStore.getState().defaultWordDuration;
    const wordCount = splitIntoWordsWithMeta(lineText(getLine("target"))).parts.length;
    await expect.poll(() => isLineSynced(getLine("target").main)).toBe(true);
    expect(mainBounds(getLine("target"))).toEqual({
      begin: placeTime,
      end: placeTime + Math.max(wordCount, 1) * wordDuration,
    });

    expect(bgVoice(getLine("sibling"))).toEqual(siblingBgBefore);
    expect(bgWords(getLine("sibling"))).toEqual([
      { text: "ooh ", begin: 20, end: 20.5 },
      { text: "ooh", begin: 20.5, end: 21 },
    ]);
  });
});

// The background lane mirrors the main lane. An untimed bg shows a Place button
// that line-syncs it; a line-synced bg renders as a single WordTrack block,
// identical to a line-synced main (no bespoke bar); a word-synced bg keeps its
// WordTrack word blocks. The Place write is per-instance and must not touch a
// linked sibling's background. LineRow receives effective lines in production
// (the timeline runs getEffectiveLines upstream), so the line-synced cases pass
// their input through getEffectiveLines to match that data flow.
describe("LineRow · background lane timing states", () => {
  function getLine(id: string) {
    const line = useProjectStore.getState().lines.find((l) => l.id === id);
    if (!line) throw new Error(`line ${id} not found`);
    return line;
  }

  function bgPlaceButton(container: HTMLElement) {
    return Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Place" && b.dataset.bgPlace);
  }

  it("shows a Place button for an untimed background and clicking it line-syncs the background", async () => {
    const placeTime = 7;
    useAudioStore.setState({ currentTime: placeTime });
    const line = createLine({ id: "l1", text: "main here", backgroundText: "ooh ooh ooh" });
    useProjectStore.setState({ lines: [line] });

    const screen = await render(
      <LineRow line={line} lineIndex={0} duration={30} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
      { dndContext: true },
    );

    const placeButton = bgPlaceButton(screen.container);
    expect(placeButton).toBeDefined();
    placeButton?.click();

    const wordDuration = useSettingsStore.getState().defaultWordDuration;
    const wordCount = splitIntoWordsWithMeta("ooh ooh ooh").parts.length;
    await expect
      .poll(() => bgBounds(getLine("l1")))
      .toEqual({
        begin: placeTime,
        end: placeTime + Math.max(wordCount, 1) * wordDuration,
      });
    expect(bgWords(getLine("l1"))).toBeUndefined();
    expect(bgText(getLine("l1"))).toBe("ooh ooh ooh");
    expect(bgSource(getLine("l1"))).toBe("manual");
  });

  it("renders a line-synced background as one bg WordTrack block and no bespoke bar", async () => {
    const main = createLine({ id: "l1", text: "main here", words: [createWord({ text: "main", begin: 0, end: 1 })] });
    const rawLine = setBackground(main, { text: "ooh ooh", begin: 3, end: 5, source: "manual" });
    useProjectStore.setState({ lines: [rawLine] });
    const line = getEffectiveLines([rawLine])[0];

    const screen = await render(
      <LineRow line={line} lineIndex={0} duration={30} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
      { dndContext: true },
    );

    expect(screen.container.querySelectorAll("[data-testid='bg-line-bar']").length).toBe(0);
    // one main word block plus one synthesized bg word block, both real WordTrack blocks
    expect(screen.container.querySelectorAll("[data-word-block]").length).toBe(2);

    expect(bgBounds(getLine("l1"))).toEqual({ begin: 3, end: 5 });
    expect(bgWords(getLine("l1"))).toBeUndefined();
  });

  it("renders a line-synced bg block as the same element type as a line-synced main block", async () => {
    const rawMain = createLine({ id: "lm", text: "main here", begin: 0, end: 2 });
    const rawWithBg = setBackground(rawMain, { text: "ooh", begin: 3, end: 5, source: "manual" });
    useProjectStore.setState({ lines: [rawWithBg] });
    const line = getEffectiveLines([rawWithBg])[0];

    const screen = await render(
      <LineRow line={line} lineIndex={0} duration={30} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
      { dndContext: true },
    );

    const blocks = Array.from(screen.container.querySelectorAll<HTMLElement>("[data-word-block]"));
    expect(blocks.length).toBe(2);
    expect(blocks[0].tagName).toBe(blocks[1].tagName);
    expect(screen.container.querySelectorAll("[data-testid='bg-line-bar']").length).toBe(0);
  });

  it("keeps rendering word blocks for a word-synced background (regression guard)", async () => {
    const line = createLine({
      id: "l1",
      text: "main here",
      words: [createWord({ text: "main", begin: 0, end: 1 })],
      backgroundText: "(echo)",
      backgroundWords: [createWord({ text: "(echo)", begin: 2, end: 3 })],
    });
    useProjectStore.setState({ lines: [line] });

    const screen = await render(
      <LineRow line={line} lineIndex={0} duration={30} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
      { dndContext: true },
    );

    expect(screen.container.querySelectorAll("[data-testid='bg-line-bar']").length).toBe(0);
    expect(screen.container.querySelectorAll("[data-word-block]").length).toBe(2);
  });

  it("placing a background via the bg Place button leaves a linked sibling's background untouched", async () => {
    const placeTime = 6;
    const group = createGroup({ id: "g1" });
    const target = reconcileLine({
      id: "target",
      text: "I love you",
      agentId: "v1",
      groupId: "g1",
      instanceIdx: 0,
      templateLineIdx: 0,
      backgroundText: "ah ah",
      backgroundTextSource: "manual",
    });
    const sibling = reconcileLine({
      id: "sibling",
      text: "I love you",
      agentId: "v1",
      groupId: "g1",
      instanceIdx: 1,
      templateLineIdx: 0,
      backgroundText: "ooh ooh",
      backgroundWords: [
        { text: "ooh ", begin: 20, end: 20.5 },
        { text: "ooh", begin: 20.5, end: 21 },
      ],
      backgroundTextSource: "manual",
    });
    useProjectStore.setState({ groups: [group], lines: [target, sibling] });
    useAudioStore.setState({ currentTime: placeTime });
    const siblingBgBefore = bgVoice(getLine("sibling"));
    expect(siblingBgBefore).not.toBeNull();

    const screen = await render(
      <LineRow line={target} lineIndex={0} duration={30} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
      { dndContext: true },
    );

    const placeButton = bgPlaceButton(screen.container);
    expect(placeButton).toBeDefined();
    placeButton?.click();

    const wordDuration = useSettingsStore.getState().defaultWordDuration;
    const wordCount = splitIntoWordsWithMeta("ah ah").parts.length;
    await expect.poll(() => isLineSynced(getLine("target").background!)).toBe(true);
    expect(bgBounds(getLine("target"))).toEqual({
      begin: placeTime,
      end: placeTime + Math.max(wordCount, 1) * wordDuration,
    });

    expect(bgVoice(getLine("sibling"))).toEqual(siblingBgBefore);
    expect(bgWords(getLine("sibling"))).toEqual([
      { text: "ooh ", begin: 20, end: 20.5 },
      { text: "ooh", begin: 20.5, end: 21 },
    ]);
  });
});

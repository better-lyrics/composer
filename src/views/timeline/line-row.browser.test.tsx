import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HIT_TESTING_UTILITIES_CSS, installStyleSheet, POSITION_UTILITIES_CSS } from "@/test/browser-css";
import { LineRow } from "@/views/timeline/line-row";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";

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
    expect(updated?.begin).toBeCloseTo(5, 5);
    expect((updated?.end ?? 0) > 5).toBe(true);
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

    await expect.poll(() => useProjectStore.getState().lines[0].backgroundWords?.length).toBe(1);
    expect(useProjectStore.getState().lines[0].backgroundTextSource).toBe("manual");
  });

  it("honours the minimum word duration setting when creating a word from the drop-zone", async () => {
    useAudioStore.setState({ duration: 0.1 });
    useSettingsStore.setState({ minWordDuration: 0.5 });
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
    dropZone?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: 100 }));
    expect(useProjectStore.getState().lines[0].backgroundWords).toBeUndefined();

    useSettingsStore.setState({ minWordDuration: 0.05 });
    dropZone?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: 100 }));
    await expect.poll(() => useProjectStore.getState().lines[0].backgroundWords?.length).toBe(1);
  });

  it("regression: double-clicking a BG zone that holds untimed bg text times that text instead of replacing it", async () => {
    useAudioStore.setState({ duration: 30 });
    const line = createLine({
      id: "l1",
      text: "hello world",
      words: [createWord({ text: "hello", begin: 0, end: 1 })],
      backgroundText: "ah ah",
    });
    useProjectStore.setState({ lines: [line] });
    const screen = await render(
      <LineRow line={line} lineIndex={0} duration={30} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
      { dndContext: true },
    );

    const dropZone = Array.from(screen.container.querySelectorAll("div")).find(
      (d) => d.textContent?.trim() === "ah ah",
    );
    expect(dropZone).toBeDefined();
    dropZone?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: 100 }));

    await expect
      .poll(() => useProjectStore.getState().lines[0].backgroundWords?.map((w) => w.text))
      .toEqual(["ah ", "ah"]);
    const after = useProjectStore.getState().lines[0];
    expect(after.backgroundText).toBe("ah ah");
    expect(after.backgroundWords?.[0].begin).toBeLessThan(after.backgroundWords?.[1].begin ?? 0);
    expect(after.backgroundWords?.[1].end).toBeLessThanOrEqual(30);
    expect(useTimelineStore.getState().editingWord).toBeNull();
  });
  describe("regressions", () => {
    let layoutStyles: HTMLStyleElement[] = [];
    beforeAll(() => {
      layoutStyles = [installStyleSheet(POSITION_UTILITIES_CSS), installStyleSheet(HIT_TESTING_UTILITIES_CSS)];
    });
    afterAll(() => {
      for (const style of layoutStyles) style.remove();
    });

    function hitTestedEvent(zone: Element, type: string) {
      const rect = zone.getBoundingClientRect();
      const x = rect.left + 20;
      const y = rect.top + rect.height / 2;
      document
        .elementFromPoint(x, y)
        ?.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    }

    function renderLinkedRow() {
      useAudioStore.setState({ duration: 30 });
      const line = createLine({
        id: "l1",
        text: "hello",
        words: [createWord({ text: "hello", begin: 0, end: 1 })],
        backgroundText: "ooh ah",
        groupId: "g1",
        instanceIdx: 0,
      });
      useProjectStore.setState({ lines: [line], groups: [createGroup({ id: "g1" })] });
      return render(
        <LineRow line={line} lineIndex={0} duration={30} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
        { dndContext: true },
      );
    }

    it("regression: a real double-click on the empty BG zone reaches it past the group tint layer", async () => {
      const screen = await renderLinkedRow();
      const zone = screen.container.querySelector("[data-track='bg']");
      if (!zone) throw new Error("missing bg zone");

      hitTestedEvent(zone, "dblclick");

      await expect
        .poll(() => useProjectStore.getState().lines[0].backgroundWords?.map((w) => w.text))
        .toEqual(["ooh ", "ah"]);
    });

    it("regression: a real right-click on the empty BG zone opens its track menu", async () => {
      const screen = await renderLinkedRow();
      const zone = screen.container.querySelector("[data-track='bg']");
      if (!zone) throw new Error("missing bg zone");

      hitTestedEvent(zone, "contextmenu");

      expect(useTimelineStore.getState().contextMenu?.target).toMatchObject({
        kind: "track",
        lineId: "l1",
        type: "bg",
      });
    });
  });

  describe("row resize handle", () => {
    it("resets the row height to the default on double-click", async () => {
      const line = createLine({ id: "l1" });
      useTimelineStore.setState({ rowHeights: { l1: 120 }, defaultRowHeight: 48 });
      useProjectStore.setState({ lines: [line] });
      const screen = await render(
        <LineRow line={line} lineIndex={0} duration={5} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
        { dndContext: true },
      );

      screen.container
        .querySelector("[role='separator']")
        ?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

      expect(useTimelineStore.getState().rowHeights.l1 ?? 48).toBe(48);
    });

    it("resizes the row while dragging the handle and stops on mouseup", async () => {
      const line = createLine({ id: "l1" });
      useTimelineStore.setState({ rowHeights: { l1: 60 } });
      useProjectStore.setState({ lines: [line] });
      const screen = await render(
        <LineRow line={line} lineIndex={0} duration={5} onUpdateWord={() => {}} onUpdateBgWord={() => {}} />,
        { dndContext: true },
      );
      const handle = screen.container.querySelector("[role='separator']");

      handle?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientY: 100 }));
      document.dispatchEvent(new MouseEvent("mousemove", { clientY: 130 }));
      document.dispatchEvent(new MouseEvent("mouseup"));
      document.dispatchEvent(new MouseEvent("mousemove", { clientY: 200 }));

      expect(useTimelineStore.getState().rowHeights.l1).toBe(90);
    });
  });
});

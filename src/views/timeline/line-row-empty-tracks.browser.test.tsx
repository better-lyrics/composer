import { describe, expect, it } from "vitest";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { EmptyBgTrack, EmptyWordTrack } from "@/views/timeline/line-row-empty-tracks";
import { useTimelineStore } from "@/views/timeline/timeline-store";

const TRACK_OFFSET_PX = 137;

function firstElement(container: HTMLElement): HTMLElement {
  const element = container.firstElementChild?.firstElementChild;
  if (!(element instanceof HTMLElement)) throw new Error("nothing rendered");
  return element;
}

async function renderWordTrack(line: ReturnType<typeof createLine>) {
  useProjectStore.setState({ lines: [line] });
  const screen = await render(
    <div style={{ paddingLeft: TRACK_OFFSET_PX }}>
      <EmptyWordTrack line={line} lineIndex={2} duration={30} rowHeight={40} />
    </div>,
  );
  return firstElement(screen.container);
}

async function renderBgTrack(line: ReturnType<typeof createLine>, isOver = false) {
  useProjectStore.setState({ lines: [line] });
  const screen = await render(
    <div style={{ paddingLeft: TRACK_OFFSET_PX }}>
      <EmptyBgTrack line={line} lineIndex={2} isOver={isOver} />
    </div>,
  );
  return firstElement(screen.container);
}

function clientXAtTime(element: HTMLElement, time: number): number {
  return element.getBoundingClientRect().left + time * useTimelineStore.getState().zoom;
}

describe("EmptyWordTrack", () => {
  it("shows the line text and a Place button", async () => {
    const track = await renderWordTrack(createLine({ text: "hello world" }));
    expect(track.textContent).toContain("hello world");
    expect(Array.from(track.querySelectorAll("button")).some((b) => b.textContent === "Place")).toBe(true);
  });

  it("sizes itself to the song duration at the current zoom", async () => {
    useTimelineStore.setState({ zoom: 10 });
    const track = await renderWordTrack(createLine({ text: "hello" }));
    expect(track.style.width).toBe("300px");
    expect(track.style.height).toBe("40px");
  });

  it("creates a word spanning the pointer time on double-click and starts editing it", async () => {
    useAudioStore.setState({ duration: 30 });
    useTimelineStore.setState({ zoom: 100 });
    const track = await renderWordTrack(createLine({ id: "l1", text: "hello world" }));

    track.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: clientXAtTime(track, 3) }));

    const word = useProjectStore.getState().lines[0].words?.[0];
    expect(word?.text).toBe("hello world");
    expect(word?.begin).toBeLessThanOrEqual(3);
    expect(word?.end).toBeGreaterThan(3);
    expect(useTimelineStore.getState().editingWord).toEqual({ lineId: "l1", wordIndex: 0, type: "word" });
  });

  it("opens a word track context menu at the pointer time", async () => {
    useTimelineStore.setState({ zoom: 50 });
    const track = await renderWordTrack(createLine({ id: "l1", text: "hello" }));

    track.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: clientXAtTime(track, 4), clientY: 9 }),
    );

    const menu = useTimelineStore.getState().contextMenu;
    expect(menu?.y).toBe(9);
    expect(menu?.target).toMatchObject({ kind: "track", lineId: "l1", lineIndex: 2, type: "word" });
    expect(menu?.target.kind === "track" ? menu.target.time : -1).toBeCloseTo(4, 5);
  });

  describe("edge cases", () => {
    it("strips split characters from the label and the created word", async () => {
      useAudioStore.setState({ duration: 30 });
      const track = await renderWordTrack(createLine({ text: "hel|lo" }));
      expect(track.textContent).toContain("hello");

      track.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: clientXAtTime(track, 1) }));
      expect(useProjectStore.getState().lines[0].words?.[0].text).toBe("hello");
    });

    it("truncates labels longer than 60 characters and caps the created word text", async () => {
      useAudioStore.setState({ duration: 30 });
      const track = await renderWordTrack(createLine({ text: "x".repeat(70) }));
      expect(track.textContent).toContain(`${"x".repeat(60)}...`);

      track.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: clientXAtTime(track, 1) }));
      expect(useProjectStore.getState().lines[0].words?.[0].text).toBe("x".repeat(60));
    });

    it("uses a placeholder word and hides Place for an empty line", async () => {
      useAudioStore.setState({ duration: 30 });
      const track = await renderWordTrack(createLine({ text: "" }));
      expect(track.querySelector("button")).toBeNull();

      track.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: clientXAtTime(track, 1) }));
      expect(useProjectStore.getState().lines[0].words?.[0].text).toBe("...");
    });

    it("does nothing when no slot fits the minimum word duration", async () => {
      useAudioStore.setState({ duration: 0.1 });
      useSettingsStore.setState({ minWordDuration: 0.5 });
      const track = await renderWordTrack(createLine({ text: "hello" }));

      track.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: clientXAtTime(track, 0) }));

      expect(useProjectStore.getState().lines[0].words).toBeUndefined();
    });
  });
});

describe("EmptyBgTrack", () => {
  const syncedLine = () =>
    createLine({ id: "l1", text: "hello", words: [createWord({ text: "hello", begin: 0, end: 1 })] });

  it("shows a BG label when the line has no background text", async () => {
    const zone = await renderBgTrack(syncedLine());
    expect(zone.textContent).toBe("BG");
    expect(zone.dataset.track).toBe("bg");
    expect(zone.dataset.lineIndex).toBe("2");
  });

  it("highlights while a word is dragged over it", async () => {
    const zone = await renderBgTrack(syncedLine(), true);
    expect(zone.className).toContain("bg-composer-accent/20");
  });

  it("creates a manual placeholder bg word on double-click and starts editing it", async () => {
    useAudioStore.setState({ duration: 30 });
    const zone = await renderBgTrack(syncedLine());

    zone.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: clientXAtTime(zone, 2) }));

    const after = useProjectStore.getState().lines[0];
    expect(after.backgroundWords?.map((w) => w.text)).toEqual(["..."]);
    expect(after.backgroundTextSource).toBe("manual");
    expect(useTimelineStore.getState().editingWord).toEqual({ lineId: "l1", wordIndex: 0, type: "bg" });
  });

  it("opens a bg track context menu at the pointer time", async () => {
    useTimelineStore.setState({ zoom: 100 });
    const zone = await renderBgTrack(syncedLine());

    zone.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: clientXAtTime(zone, 1.25) }),
    );

    const menu = useTimelineStore.getState().contextMenu;
    expect(menu?.target).toMatchObject({ kind: "track", lineId: "l1", lineIndex: 2, type: "bg" });
    expect(menu?.target.kind === "track" ? menu.target.time : -1).toBeCloseTo(1.25, 5);
  });

  describe("regressions", () => {
    it("regression: times existing untimed bg text instead of replacing it with a placeholder", async () => {
      useAudioStore.setState({ duration: 30 });
      const zone = await renderBgTrack({ ...syncedLine(), backgroundText: "ooh ah" });

      zone.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: clientXAtTime(zone, 2) }));

      const after = useProjectStore.getState().lines[0];
      expect(after.backgroundWords?.map((w) => w.text)).toEqual(["ooh ", "ah"]);
      expect(after.backgroundText).toBe("ooh ah");
      expect(useTimelineStore.getState().editingWord).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("truncates background text longer than 40 characters", async () => {
      const zone = await renderBgTrack({ ...syncedLine(), backgroundText: "b".repeat(41) });
      expect(zone.textContent).toBe(`${"b".repeat(40)}...`);
    });

    it("keeps background text of exactly 40 characters whole", async () => {
      const zone = await renderBgTrack({ ...syncedLine(), backgroundText: "c".repeat(40) });
      expect(zone.textContent).toBe("c".repeat(40));
    });
  });

  describe("invariants", () => {
    it("does not touch the main words when adding a bg word", async () => {
      useAudioStore.setState({ duration: 30 });
      const line = syncedLine();
      const zone = await renderBgTrack(line);

      zone.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: clientXAtTime(zone, 2) }));

      expect(useProjectStore.getState().lines[0].words).toEqual(line.words);
    });
  });
});

describe("empty tracks in a group that shares timing", () => {
  const verse = (id: string, instanceIdx: number, templateLineIdx: number, begin?: number) =>
    createLine({
      id,
      text: templateLineIdx === 0 ? "go now" : "oh yeah no",
      groupId: "g1",
      instanceIdx,
      templateLineIdx,
      ...(begin === undefined
        ? {}
        : {
            words: [
              createWord({ text: "go ", begin, end: begin + 1 }),
              createWord({ text: "now", begin: begin + 1, end: begin + 2 }),
            ],
          }),
    });

  async function renderEmpty(sharesTiming: boolean, track: "word" | "bg") {
    useAudioStore.setState({ duration: 20 });
    useTimelineStore.setState({ zoom: 100 });
    useSettingsStore.setState({ defaultWordDuration: 1, minWordDuration: 0.05 });
    const target = { ...verse("b0", 0, 1), ...(track === "bg" ? { backgroundText: "oh yeah no" } : {}) };
    useProjectStore.setState({
      lines: [verse("a0", 0, 0, 3), target, verse("a1", 1, 0, 10), verse("b1", 1, 1)],
      groups: [createGroup({ id: "g1", ...(sharesTiming ? { sharesTiming: true } : {}) })],
    });
    const screen = await render(
      <div style={{ paddingLeft: TRACK_OFFSET_PX }}>
        {track === "word" ? (
          <EmptyWordTrack line={target} lineIndex={1} duration={20} rowHeight={40} />
        ) : (
          <EmptyBgTrack line={target} lineIndex={1} isOver={false} />
        )}
      </div>,
    );
    return firstElement(screen.container);
  }

  const lineById = (id: string) => useProjectStore.getState().lines.find((line) => line.id === id);

  it("keeps the new word inside the range where the latest instance reaches the song end", async () => {
    const track = await renderEmpty(true, "word");

    track.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: clientXAtTime(track, 12.9) }));

    await expect.poll(() => lineById("b0")?.words?.[0]).toMatchObject({ begin: 12, end: 13 });
    expect(lineById("b1")?.words?.[0]).toMatchObject({ begin: 19, end: 20 });
  });

  it("ends timed background text where the latest instance reaches the song end", async () => {
    const track = await renderEmpty(true, "bg");
    useSettingsStore.setState({ defaultWordDuration: 0.2 });

    track.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: clientXAtTime(track, 12.9) }));

    await expect.poll(() => lineById("b0")?.backgroundWords?.length).toBe(3);
    expect(lineById("b0")?.backgroundWords?.at(-1)?.end).toBeLessThanOrEqual(13);
    expect(lineById("b1")?.backgroundWords?.at(-1)?.end).toBeLessThanOrEqual(20);
  });

  describe("regressions", () => {
    it("regression: a line of an old group still places the word up to the song end", async () => {
      const track = await renderEmpty(false, "word");

      track.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: clientXAtTime(track, 12.9) }));

      await expect.poll(() => lineById("b0")?.words?.length).toBe(1);
      expect(lineById("b0")?.words?.[0].begin).toBeCloseTo(12.4, 5);
      expect(lineById("b0")?.words?.[0].end).toBeCloseTo(13.4, 5);
      expect(lineById("b1")?.words).toBeUndefined();
    });
  });
});

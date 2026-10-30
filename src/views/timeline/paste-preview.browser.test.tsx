import { useRef } from "react";
import { beforeEach, describe, expect, it, onTestFinished } from "vitest";
import { userEvent } from "vitest/browser";
import type { LyricLine } from "@/domain/line/model";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { installUtilitiesUsedIn } from "@/test/browser-css";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { GROUP_HEADER_HEIGHT } from "@/views/timeline/group-header-row";
import { PastePreview } from "@/views/timeline/paste-preview";
import { wordBlockWidth } from "@/views/timeline/row-geometry";
import type { ClipboardData } from "@/views/timeline/selection-types";
import { GUTTER_WIDTH, useTimelineStore, WAVEFORM_HEIGHT } from "@/views/timeline/timeline-store";
import { computeRowLayout } from "@/views/timeline/utils";

// -- Fixtures -----------------------------------------------------------------

const PASTE_TIME = 30;

const chorusLine = (id: string, instanceIdx: number, begin: number, secondWordAt: number): LyricLine =>
  createLine({
    id,
    text: "go now",
    words: [
      createWord({ text: "go ", begin, end: begin + 1 }),
      createWord({ text: "now", begin: begin + secondWordAt, end: begin + secondWordAt + 1 }),
    ],
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
  });

const ownTimingChorus = chorusLine("c0", 0, 3, 1.5);
const sharedChorus = chorusLine("c2", 2, 40, 1);

function seedProject() {
  useAudioStore.setState({ duration: 60 });
  useProjectStore.setState({
    groups: [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [0, 1] })],
    lines: [ownTimingChorus, createLine({ id: "e", text: "" }), sharedChorus],
  });
  useProjectStore.getState().clearHistory();
}

function EmptyHarness() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} style={{ overflow: "auto", width: 400, height: 200 }}>
      <PastePreview clipboard={{ entries: [] }} scrollContainerRef={ref} />
    </div>
  );
}

function Harness({ clipboard }: { clipboard: ClipboardData }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <>
      <div style={{ position: "relative", width: 800, height: 600 }}>
        <div ref={ref} data-scroll-container style={{ overflow: "auto", width: 800, height: 600 }}>
          <div style={{ height: 2000 }} />
        </div>
        <PastePreview clipboard={clipboard} scrollContainerRef={ref} />
      </div>
      <ConfirmModalHost />
    </>
  );
}

function scrollContainerOf(screen: Awaited<ReturnType<typeof render>>) {
  const container = screen.container.querySelector<HTMLElement>("[data-scroll-container]");
  if (!container) throw new Error("no scroll container");
  return container;
}

function pointOnRow(container: HTMLElement, lineId: string, time: number, lane: "word" | "bg" = "word") {
  const { zoom, rowHeights, defaultRowHeight, collapsedInstances, focusedGroup } = useTimelineStore.getState();
  const layout = computeRowLayout({
    lines: useProjectStore.getState().lines,
    rowHeights,
    defaultRowHeight,
    collapsedInstances,
    focusedGroup,
    waveformHeight: WAVEFORM_HEIGHT + 1,
    groupHeaderHeight: GROUP_HEADER_HEIGHT,
  });
  const row = layout.lineTops.get(lineId);
  if (!row) throw new Error(`row ${lineId} has no layout`);
  const rect = container.getBoundingClientRect();
  const laneTop = lane === "word" ? row.top : row.mainBottom;
  return { clientX: rect.left + GUTTER_WIDTH + time * zoom, clientY: rect.top + laneTop + 2 };
}

async function hoverRow(
  screen: Awaited<ReturnType<typeof render>>,
  lineId: string,
  time: number,
  lane: "word" | "bg" = "word",
) {
  const container = scrollContainerOf(screen);
  const point = pointOnRow(container, lineId, time, lane);
  document.dispatchEvent(new MouseEvent("mousemove", point));
  await expect.poll(() => screen.container.querySelector("[data-lane]")).not.toBeNull();
  return { container, point };
}

async function pasteOnRow(
  screen: Awaited<ReturnType<typeof render>>,
  lineId: string,
  time: number,
  lane: "word" | "bg" = "word",
) {
  const { container, point } = await hoverRow(screen, lineId, time, lane);
  container.dispatchEvent(new MouseEvent("click", { ...point, bubbles: true, button: 0 }));
}

const pasteOnEmptyRow = (screen: Awaited<ReturnType<typeof render>>) => pasteOnRow(screen, "e", PASTE_TIME);

const store = () => useProjectStore.getState();
const lineById = (id: string) => store().lines.find((line) => line.id === id);
const entriesOf = (line: LyricLine) =>
  (line.words ?? []).map((word) => ({ word, lineOffset: 0, trackType: "word" as const }));

// -- Tests --------------------------------------------------------------------

describe("PastePreview", () => {
  it("renders nothing for an empty paste clipboard", async () => {
    const screen = await render(<EmptyHarness />);
    expect(screen.container.textContent ?? "").toBe("");
  });
});

describe("PastePreview · paste into a group that shares timing", () => {
  beforeEach(seedProject);

  it("links matching lines with the timing of a shared instance, not an own-timing one", async () => {
    const copied = {
      ...ownTimingChorus,
      id: "copy",
      groupId: undefined,
      instanceIdx: undefined,
      templateLineIdx: undefined,
    };
    const screen = await render(<Harness clipboard={{ entries: entriesOf(copied), candidateLines: [copied] }} />);

    await pasteOnEmptyRow(screen);
    await screen.getByRole("button", { name: "Link as instance" }).click();

    await expect.poll(() => lineById("e")?.instanceIdx).toBe(1);
    expect(lineById("e")?.words?.[1].begin).toBe(PASTE_TIME + 1);
  });

  it("gives an instance pasted from an own-timing copy the shared timing", async () => {
    const clipboard = { entries: entriesOf(ownTimingChorus), sourceInstance: { groupId: "g1", instanceIdx: 0 } };
    const screen = await render(<Harness clipboard={clipboard} />);

    await pasteOnEmptyRow(screen);

    await expect.poll(() => lineById("e")?.instanceIdx).toBe(1);
    expect(lineById("e")?.words?.[1].begin).toBe(PASTE_TIME + 1);
  });

  describe("regressions", () => {
    it("regression: a pasted instance does not inherit a removed instance's own timing", async () => {
      const clipboard = { entries: entriesOf(ownTimingChorus), sourceInstance: { groupId: "g1", instanceIdx: 0 } };
      const screen = await render(<Harness clipboard={clipboard} />);

      await pasteOnEmptyRow(screen);

      await expect.poll(() => lineById("e")?.instanceIdx).toBe(1);
      expect(store().groups[0].ownTimingInstances).toEqual([0]);
    });

    it("regression: undo restores the row and the group in one step", async () => {
      const clipboard = { entries: entriesOf(ownTimingChorus), sourceInstance: { groupId: "g1", instanceIdx: 0 } };
      const screen = await render(<Harness clipboard={clipboard} />);

      await pasteOnEmptyRow(screen);
      await expect.poll(() => lineById("e")?.instanceIdx).toBe(1);
      store().undo();

      expect(lineById("e")?.groupId).toBeUndefined();
      expect(store().groups[0].ownTimingInstances).toEqual([0, 1]);
    });

    it("regression: the timeline scrolls under an open paste preview", async () => {
      const clipboard = { entries: entriesOf(ownTimingChorus), sourceInstance: { groupId: "g1", instanceIdx: 0 } };
      const screen = await render(<Harness clipboard={clipboard} />);
      const container = scrollContainerOf(screen);
      await hoverRow(screen, "e", PASTE_TIME);
      const utilities = await installUtilitiesUsedIn(screen.container);
      onTestFinished(() => utilities.remove());

      await userEvent.wheel(screen.container.firstElementChild ?? container, { delta: { y: 400 } });

      await expect.poll(() => container.scrollTop).toBeGreaterThan(0);
    });
  });
});

describe("PastePreview · paste words onto a line of a group that shares timing", () => {
  const ZOOM = 20;
  const wordClipboard: ClipboardData = {
    entries: [{ word: createWord({ text: "z", begin: 0, end: 1 }), lineOffset: 0, trackType: "word" }],
  };

  function seedChorus(sharesTiming: boolean) {
    useAudioStore.setState({ duration: 20 });
    useSettingsStore.setState({ timelineSnap: false });
    useTimelineStore.setState({ zoom: ZOOM });
    useProjectStore.setState({
      groups: [createGroup({ id: "g1", ...(sharesTiming ? { sharesTiming: true } : {}) })],
      lines: [chorusLine("c0", 0, 3, 1), chorusLine("c1", 1, 10, 1)],
    });
    useProjectStore.getState().clearHistory();
  }

  const ghostWidth = (screen: Awaited<ReturnType<typeof render>>) => {
    const ghost = screen.container.querySelector<HTMLElement>("[data-lane]");
    if (!ghost) throw new Error("no ghost word");
    return Number.parseFloat(ghost.style.width);
  };

  it("ends the pasted word where the latest instance reaches the song end", async () => {
    seedChorus(true);
    const screen = await render(<Harness clipboard={wordClipboard} />);

    await pasteOnRow(screen, "c0", 12.5);

    await expect.poll(() => lineById("c0")?.words).toHaveLength(3);
    expect(lineById("c0")?.words?.[2].begin).toBeCloseTo(12.5, 5);
    expect(lineById("c0")?.words?.[2].end).toBeCloseTo(13, 5);
    expect(lineById("c1")?.words?.[2].end).toBeCloseTo(20, 5);
  });

  it("previews the pasted word cut at the range end", async () => {
    seedChorus(true);
    const screen = await render(<Harness clipboard={wordClipboard} />);

    await hoverRow(screen, "c0", 12.5);

    expect(ghostWidth(screen)).toBeCloseTo(wordBlockWidth(12.5, 13, ZOOM), 3);
  });

  describe("regressions", () => {
    it("regression: a line of an old group still takes the pasted word up to the song end", async () => {
      seedChorus(false);
      const screen = await render(<Harness clipboard={wordClipboard} />);

      await hoverRow(screen, "c0", 12.5);
      expect(ghostWidth(screen)).toBeCloseTo(wordBlockWidth(12.5, 13.5, ZOOM), 3);
      await pasteOnRow(screen, "c0", 12.5);

      await expect.poll(() => lineById("c0")?.words).toHaveLength(3);
      expect(lineById("c0")?.words?.[2].end).toBeCloseTo(13.5, 5);
    });
  });
});

describe("PastePreview · paste into the hovered lane", () => {
  it("pastes words copied from a main lane into the hovered background lane", async () => {
    useAudioStore.setState({ duration: 60 });
    useProjectStore.setState({ lines: [createLine({ id: "l", text: "go now", words: ownTimingChorus.words })] });
    const clipboard: ClipboardData = {
      entries: [{ word: createWord({ text: "you", begin: 0, end: 1 }), lineOffset: 0, trackType: "word" }],
    };
    const screen = await render(<Harness clipboard={clipboard} />);

    await pasteOnRow(screen, "l", 10, "bg");

    await expect.poll(() => lineById("l")?.backgroundWords?.map((word) => word.text)).toEqual(["you"]);
    expect(lineById("l")?.words).toEqual(ownTimingChorus.words);
  });
});

describe("PastePreview · paste an instance", () => {
  it("regression: places a line-synced main line where its ghost shows when its background starts later", async () => {
    useAudioStore.setState({ duration: 60 });
    const chorus = createLine({ id: "c", text: "oh", begin: 10, end: 11, groupId: "g1", instanceIdx: 0 });
    useProjectStore.setState({
      groups: [createGroup({ id: "g1" })],
      lines: [
        { ...chorus, templateLineIdx: 0, backgroundWords: [createWord({ text: "ah", begin: 12, end: 13 })] },
        createLine({ id: "e", text: "" }),
      ],
    });
    const screen = await render(
      <Harness clipboard={{ entries: [], sourceInstance: { groupId: "g1", instanceIdx: 0 } }} />,
    );

    await pasteOnEmptyRow(screen);

    await expect.poll(() => lineById("e")?.begin).toBeCloseTo(PASTE_TIME, 5);
  });
});

import type { LyricLine } from "@/domain/line/model";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { GROUP_HEADER_HEIGHT } from "@/views/timeline/group-header-row";
import { PastePreview } from "@/views/timeline/paste-preview";
import type { ClipboardData } from "@/views/timeline/selection-types";
import { GUTTER_WIDTH, WAVEFORM_HEIGHT, useTimelineStore } from "@/views/timeline/timeline-store";
import { computeRowLayout } from "@/views/timeline/utils";
import { useRef } from "react";
import { beforeEach, describe, expect, it } from "vitest";

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
      <div ref={ref} style={{ position: "relative", overflow: "auto", width: 800, height: 600 }}>
        <PastePreview clipboard={clipboard} scrollContainerRef={ref} />
      </div>
      <ConfirmModalHost />
    </>
  );
}

function pointOnRow(container: HTMLElement, lineId: string, time: number) {
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
  return { clientX: rect.left + GUTTER_WIDTH + time * zoom, clientY: rect.top + row.top + 2 };
}

async function hoverRow(screen: Awaited<ReturnType<typeof render>>, lineId: string, time: number) {
  const container = screen.container.querySelector("div");
  if (!container) throw new Error("no scroll container");
  const point = pointOnRow(container, lineId, time);
  document.dispatchEvent(new MouseEvent("mousemove", point));
  const overlay = screen.getByRole("button", { name: "Place pasted content here" });
  await expect.element(overlay).toBeInTheDocument();
  return { overlay: overlay.element(), point };
}

async function pasteOnRow(screen: Awaited<ReturnType<typeof render>>, lineId: string, time: number) {
  const { overlay, point } = await hoverRow(screen, lineId, time);
  overlay.dispatchEvent(new MouseEvent("click", { ...point, bubbles: true, button: 0 }));
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
  });
});

describe("PastePreview · paste words onto a line of a group that shares timing", () => {
  const ZOOM = 20;
  const wordClipboard: ClipboardData = {
    entries: [{ word: createWord({ text: "z", begin: 0, end: 1 }), lineOffset: 0, trackType: "word" }],
  };

  function seedChorus(sharesTiming: boolean) {
    useAudioStore.setState({ duration: 20 });
    useTimelineStore.setState({ zoom: ZOOM });
    useProjectStore.setState({
      groups: [createGroup({ id: "g1", ...(sharesTiming ? { sharesTiming: true } : {}) })],
      lines: [chorusLine("c0", 0, 3, 1), chorusLine("c1", 1, 10, 1)],
    });
    useProjectStore.getState().clearHistory();
  }

  const ghostWidth = (overlay: Element) => {
    const ghost = overlay.querySelector<HTMLElement>(".pointer-events-none");
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

    const { overlay } = await hoverRow(screen, "c0", 12.5);

    expect(ghostWidth(overlay)).toBeCloseTo(0.5 * ZOOM, 3);
  });

  describe("regressions", () => {
    it("regression: a line of an old group still takes the pasted word up to the song end", async () => {
      seedChorus(false);
      const screen = await render(<Harness clipboard={wordClipboard} />);

      expect(ghostWidth((await hoverRow(screen, "c0", 12.5)).overlay)).toBeCloseTo(ZOOM, 3);
      await pasteOnRow(screen, "c0", 12.5);

      await expect.poll(() => lineById("c0")?.words).toHaveLength(3);
      expect(lineById("c0")?.words?.[2].end).toBeCloseTo(13.5, 5);
    });
  });
});

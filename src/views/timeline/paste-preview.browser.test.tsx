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

function pointOnEmptyRow(container: HTMLElement) {
  const { zoom, rowHeights, defaultRowHeight, collapsedInstances } = useTimelineStore.getState();
  const layout = computeRowLayout({
    lines: useProjectStore.getState().lines,
    rowHeights,
    defaultRowHeight,
    collapsedInstances,
    waveformHeight: WAVEFORM_HEIGHT + 1,
    groupHeaderHeight: GROUP_HEADER_HEIGHT,
  });
  const row = layout.lineTops.get("e");
  if (!row) throw new Error("empty row has no layout");
  const rect = container.getBoundingClientRect();
  return { clientX: rect.left + GUTTER_WIDTH + PASTE_TIME * zoom, clientY: rect.top + row.top + 2 };
}

async function pasteOnEmptyRow(screen: Awaited<ReturnType<typeof render>>) {
  const container = screen.container.querySelector("div");
  if (!container) throw new Error("no scroll container");
  const point = pointOnEmptyRow(container);
  document.dispatchEvent(new MouseEvent("mousemove", point));
  const overlay = screen.getByRole("button", { name: "Place pasted content here" });
  await expect.element(overlay).toBeInTheDocument();
  overlay.element().dispatchEvent(new MouseEvent("click", { ...point, bubbles: true, button: 0 }));
}

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

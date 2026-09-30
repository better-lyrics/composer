import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { isMac } from "@/utils/platform";
import { TimelinePanel } from "@/views/timeline/timeline-panel";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { getWordsInInstance } from "@/views/timeline/utils";
import { beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Fixtures -----------------------------------------------------------------

const chorus = (instanceIdx: number, begin: number) =>
  createLine({
    id: `c${instanceIdx}`,
    text: "go now",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [
      createWord({ text: "go ", begin, end: begin + 1 }),
      createWord({ text: "now", begin: begin + 1, end: begin + 2 }),
    ],
  });

const verse = createLine({ id: "v", text: "verse", words: [createWord({ text: "verse", begin: 20, end: 21 })] });

function seed() {
  useAudioStore.setState({ source: { type: "file", file: createAudioFile() }, duration: 120 });
  useProjectStore.setState({
    activeTab: "timeline",
    groups: [createGroup({ id: "g1", label: "Chorus", sharesTiming: true, ownTimingInstances: [2] })],
    lines: [chorus(0, 10), verse, chorus(1, 40), chorus(2, 70)],
  });
  useProjectStore.getState().clearHistory();
}

const focus = () => useTimelineStore.getState().focusedGroup;
const selectedLineIds = () => useTimelineStore.getState().selectedWords.map((word) => word.lineId);

function banner(instanceIdx: number): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-instance-key="g1:${instanceIdx}"]`);
  if (!el) throw new Error(`banner ${instanceIdx} not rendered`);
  return el;
}

function pressMod(key: string, code: string, init: KeyboardEventInit = {}) {
  window.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      code,
      metaKey: isMac,
      ctrlKey: !isMac,
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  );
}

const pressNextInstance = () => pressMod("k", "KeyK");
const pressPrevInstance = () => pressMod("j", "KeyJ");

async function renderOpen(instanceIdx: number) {
  await render(<TimelinePanel />);
  await expect.poll(() => document.querySelectorAll("[data-instance-key]").length).toBe(3);
  await userEvent.dblClick(banner(instanceIdx));
  await expect.poll(() => focus()?.hearInstanceIdx).toBe(instanceIdx);
}

beforeEach(seed);

// -- Tests --------------------------------------------------------------------

describe("TimelinePanel · instance jumps in an open group", () => {
  it("hears the next shared instance, skipping the own-timing one", async () => {
    await renderOpen(1);

    pressNextInstance();

    await expect.poll(() => focus()).toEqual({ groupId: "g1", hearInstanceIdx: 0 });
    expect(selectedLineIds()).toEqual([]);
  });

  it("hears the previous shared instance", async () => {
    await renderOpen(0);

    pressPrevInstance();

    await expect.poll(() => focus()).toEqual({ groupId: "g1", hearInstanceIdx: 1 });
  });

  it("jumps without a selection", async () => {
    await renderOpen(0);
    expect(selectedLineIds()).toEqual([]);

    pressNextInstance();

    await expect.poll(() => focus()?.hearInstanceIdx).toBe(1);
  });

  describe("edge cases", () => {
    it("stays on an open own-timing instance", async () => {
      await renderOpen(2);

      pressNextInstance();
      pressPrevInstance();

      expect(focus()).toEqual({ groupId: "g1", hearInstanceIdx: 2 });
      expect(selectedLineIds()).toEqual([]);
    });
  });

  describe("regressions", () => {
    it("regression: never selects words of an instance that is not shown", async () => {
      await renderOpen(1);
      useTimelineStore.getState().setSelectedWords(getWordsInInstance(useProjectStore.getState().lines, "g1", 1));

      pressNextInstance();

      await expect.poll(() => focus()?.hearInstanceIdx).toBe(0);
      expect(selectedLineIds()).toEqual([]);
    });

    it("regression: jumps to the start of the open instance", async () => {
      const longChorus = createLine({
        ...chorus(1, 40),
        words: [createWord({ text: "go ", begin: 40, end: 50 }), createWord({ text: "now", begin: 50, end: 60 })],
      });
      useProjectStore.setState({ lines: [chorus(0, 10), verse, longChorus, chorus(2, 70)] });
      useTimelineStore.setState({ zoom: 50 });
      await render(<TimelinePanel />);
      await expect.poll(() => document.querySelectorAll("[data-instance-key]").length).toBe(3);
      useTimelineStore.getState().openGroup("g1", 1);
      const scrollLeft = () => document.querySelector<HTMLDivElement>("[data-scroll-container]")?.scrollLeft ?? 0;
      await expect.poll(scrollLeft).toBeGreaterThan(40 * 50 - 100);
      const container = document.querySelector<HTMLDivElement>("[data-scroll-container]");
      if (!container) throw new Error("no scroll container");
      const start = container.scrollLeft;
      container.scrollLeft = start + 200;
      await expect.poll(() => container.scrollLeft).toBeGreaterThan(start);

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "J", code: "KeyJ", shiftKey: true, bubbles: true }));

      await expect.poll(() => container.scrollLeft).toBe(start);
    });
  });
});

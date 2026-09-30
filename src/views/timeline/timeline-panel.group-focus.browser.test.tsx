import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { isMac } from "@/utils/platform";
import { TimelinePanel } from "@/views/timeline/timeline-panel";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { userEvent } from "vitest/browser";
import { beforeEach, describe, expect, it } from "vitest";

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
const lineById = (id: string) => useProjectStore.getState().lines.find((line) => line.id === id);

function shownLineIndices(): number[] {
  return [...document.querySelectorAll<HTMLElement>('[data-track="word"]')].map((el) => Number(el.dataset.lineIndex));
}

function banner(instanceIdx: number): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-instance-key="g1:${instanceIdx}"]`);
  if (!el) throw new Error(`banner ${instanceIdx} not rendered`);
  return el;
}

function press(key: string, init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
}

function pressSelectAll() {
  press("a", { code: "KeyA", metaKey: isMac, ctrlKey: !isMac });
}

async function renderOpen(instanceIdx: number) {
  const screen = await render(<TimelinePanel />);
  await expect.poll(() => document.querySelectorAll("[data-instance-key]").length).toBe(3);
  await userEvent.dblClick(banner(instanceIdx));
  await expect.poll(() => focus()?.hearInstanceIdx).toBe(instanceIdx);
  return screen;
}

beforeEach(seed);

// -- Tests --------------------------------------------------------------------

describe("TimelinePanel · group focus", () => {
  it("opens the group on a banner double-click and shows only that instance", async () => {
    await renderOpen(1);

    await expect.poll(shownLineIndices).toEqual([2]);
    expect(document.querySelectorAll("[data-group-header]")).toHaveLength(0);
  });

  it("opens only the own-timing instance", async () => {
    await renderOpen(2);

    await expect.poll(shownLineIndices).toEqual([3]);
  });

  it("applies an edit in the open group to every placed shared instance", async () => {
    await renderOpen(1);
    pressSelectAll();
    await expect.poll(() => useTimelineStore.getState().selectedWords).toHaveLength(2);

    press("ArrowRight");

    await expect.poll(() => lineById("c1")?.words?.[0].begin).toBeGreaterThan(40);
    const delta = (lineById("c1")?.words?.[0].begin ?? 0) - 40;
    expect(lineById("c0")?.words?.[0].begin).toBeCloseTo(10 + delta);
    expect(lineById("c2")?.words?.[0].begin).toBe(70);
    expect(lineById("v")?.words?.[0].begin).toBe(20);
  });

  describe("keyboard", () => {
    it("selects only the open instance with select all", async () => {
      await renderOpen(1);

      pressSelectAll();

      await expect
        .poll(() => useTimelineStore.getState().selectedWords.map((word) => word.lineId))
        .toEqual(["c1", "c1"]);
    });
  });

  describe("scroll", () => {
    it("scrolls to the heard instance and keeps the scroll inside it", async () => {
      useTimelineStore.setState({ zoom: 50 });
      await renderOpen(1);
      const container = document.querySelector<HTMLDivElement>("[data-scroll-container]");
      if (!container) throw new Error("no scroll container");

      await expect.poll(() => container.scrollLeft).toBeGreaterThan(40 * 50 - 100);
      container.scrollLeft = 0;

      await expect.poll(() => container.scrollLeft).toBeGreaterThan(40 * 50 - 100);
    });
  });

  describe("regressions", () => {
    it("regression: a double-click on the group label still renames the group", async () => {
      const screen = await render(<TimelinePanel />);
      await expect.poll(() => document.querySelectorAll("[data-group-header]").length).toBe(3);
      const label = document.querySelector<HTMLElement>('[data-group-header="g1:0"] button');
      if (!label) throw new Error("group label not rendered");

      await userEvent.dblClick(label);

      await expect.element(screen.getByRole("textbox", { name: "Group name" })).toBeVisible();
      expect(focus()).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("closes the group when its instance goes away", async () => {
      await renderOpen(1);

      useProjectStore.setState({ lines: [chorus(0, 10), verse] });

      await expect.poll(() => focus()).toBeNull();
    });
  });
});

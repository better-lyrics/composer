import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { isMac } from "@/utils/platform";
import { TimelinePanel } from "@/views/timeline/timeline-panel";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { expect } from "vitest";
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

function seedGroupFocusSong() {
  useAudioStore.setState({ source: { type: "file", file: createAudioFile() }, duration: 120 });
  useProjectStore.setState({
    activeTab: "timeline",
    groups: [createGroup({ id: "g1", label: "Chorus", sharesTiming: true, ownTimingInstances: [2] })],
    lines: [chorus(0, 10), verse, chorus(1, 40), chorus(2, 70)],
  });
  useProjectStore.getState().clearHistory();
}

// -- Components ---------------------------------------------------------------

const PlayableTimeline: React.FC = () => {
  useGlobalShortcuts({ setActiveTab: () => {}, setHelpOpen: () => {}, setSettingsOpen: () => {} });
  return <TimelinePanel />;
};

// -- Queries ------------------------------------------------------------------

const focus = () => useTimelineStore.getState().focusedGroup;
const store = () => useProjectStore.getState();
const lineById = (id: string) => store().lines.find((line) => line.id === id);
const selectedLineIds = () => useTimelineStore.getState().selectedWords.map((word) => word.lineId);

function shownLineIndices(): number[] {
  return [...document.querySelectorAll<HTMLElement>('[data-track="word"]')].map((el) => Number(el.dataset.lineIndex));
}

function banner(instanceIdx: number): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-instance-key="g1:${instanceIdx}"]`);
  if (!el) throw new Error(`banner ${instanceIdx} not rendered`);
  return el;
}

function scrollContainer(): HTMLDivElement {
  const container = document.querySelector<HTMLDivElement>("[data-scroll-container]");
  if (!container) throw new Error("no scroll container");
  return container;
}

// -- Actions ------------------------------------------------------------------

function press(key: string, init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
}

function pressMod(key: string, code: string, init: KeyboardEventInit = {}) {
  press(key, { code, metaKey: isMac, ctrlKey: !isMac, ...init });
}

function pressSelectAll() {
  pressMod("a", "KeyA");
}

async function renderOpen(instanceIdx: number) {
  const screen = await render(<TimelinePanel />);
  await expect.poll(() => document.querySelectorAll("[data-instance-key]").length).toBe(3);
  await userEvent.dblClick(banner(instanceIdx));
  await expect.poll(() => focus()?.hearInstanceIdx).toBe(instanceIdx);
  return screen;
}

// -- Exports ------------------------------------------------------------------

export {
  PlayableTimeline,
  banner,
  chorus,
  focus,
  lineById,
  press,
  pressMod,
  pressSelectAll,
  renderOpen,
  scrollContainer,
  seedGroupFocusSong,
  selectedLineIds,
  shownLineIndices,
  store,
  verse,
};

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { useAudioStore } from "@/stores/audio";
import { installStyleSheet, POSITION_UTILITIES_CSS } from "@/test/browser-css";
import { allowConsole } from "@/test/console-guard";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { TimelinePanel } from "@/views/timeline/timeline-panel";
import { playheadMaskRoot } from "@/views/timeline/timeline-playhead-mask";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Constants -----------------------------------------------------------------

const DRAG_ACTIVATION_PX = 8;
const DRAG_DISTANCE_PX = 40;
const SCROLL_VIEWPORT_HEIGHT = 300;

// -- Harness -------------------------------------------------------------------

let positionUtilities: HTMLStyleElement;

function seedTimeline(): void {
  useAudioStore.setState({ source: { type: "file", file: createAudioFile() }, duration: 60 });
  useTimelineStore.setState({ zoom: 100 });
  useProjectStore.setState({
    activeTab: "timeline",
    lines: Array.from({ length: 4 }, (_, i) =>
      createLine({
        id: `line-${i}`,
        text: `lyric ${i}`,
        words: [createWord({ text: `lyric${i}`, begin: i * 2, end: i * 2 + 1.5 })],
      }),
    ),
  });
}

function maskRootElement(): HTMLElement {
  const root = document.querySelector<HTMLElement>("[data-timeline-mask-root]");
  if (!root) throw new Error("mask root missing");
  return root;
}

function scrollContainer(): HTMLElement {
  const container = document.querySelector<HTMLElement>("[data-scroll-container]");
  if (!container) throw new Error("scroll container missing");
  return container;
}

function makeScrollable(): void {
  const container = scrollContainer();
  container.style.height = `${SCROLL_VIEWPORT_HEIGHT}px`;
  container.style.overflow = "auto";
}

async function firstWordBlock(): Promise<HTMLElement> {
  await expect.poll(() => scrollContainer().querySelectorAll("[data-word-block]").length).toBeGreaterThan(0);
  const block = scrollContainer().querySelector<HTMLElement>("[data-word-block]");
  if (!block) throw new Error("no word block rendered");
  return block;
}

function dragGhostBlocks(): HTMLElement[] {
  const inScrollContainer = new Set(scrollContainer().querySelectorAll("[data-word-block]"));
  return [...document.querySelectorAll<HTMLElement>("[data-word-block]")].filter(
    (block) => !inScrollContainer.has(block),
  );
}

function pressAndDrag(block: HTMLElement): void {
  const rect = block.getBoundingClientRect();
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;
  block.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      isPrimary: true,
      pointerId: 1,
      pointerType: "mouse",
      clientX: startX,
      clientY: startY,
    }),
  );
  document.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      isPrimary: true,
      pointerId: 1,
      pointerType: "mouse",
      clientX: startX + DRAG_ACTIVATION_PX + DRAG_DISTANCE_PX,
      clientY: startY,
    }),
  );
}

function releasePointer(): void {
  document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
}

beforeAll(() => {
  positionUtilities = installStyleSheet(POSITION_UTILITIES_CSS);
});

afterAll(() => positionUtilities.remove());

afterEach(() => releasePointer());

// -- Tests ---------------------------------------------------------------------

describe("TimelinePanel mask root", () => {
  it("marks a root that contains the timeline scroll container", async () => {
    seedTimeline();
    await render(<TimelinePanel />);

    expect(maskRootElement().contains(scrollContainer())).toBe(true);
    expect(playheadMaskRoot(scrollContainer())).toBe(maskRootElement());
  });

  it("marks a root that also contains the drag overlay's ghost", async () => {
    // Pre-existing: dnd-kit applies modifiers during render, and useTimelineSnap writes the
    // snapped leader to the timeline store from inside one. Unrelated to the mask root.
    allowConsole(/while rendering a different component/);
    seedTimeline();
    await render(<TimelinePanel />);
    makeScrollable();
    pressAndDrag(await firstWordBlock());

    await expect.poll(() => dragGhostBlocks().length).toBeGreaterThan(0);
    const root = playheadMaskRoot(scrollContainer());
    for (const ghost of dragGhostBlocks()) {
      expect(root.contains(ghost)).toBe(true);
      expect(scrollContainer().contains(ghost)).toBe(false);
    }
  });

  it("resolves without the product tour anchor, which names an unrelated concept", async () => {
    seedTimeline();
    await render(<TimelinePanel />);
    for (const anchor of document.querySelectorAll("[data-tour='timeline-panel']")) {
      anchor.removeAttribute("data-tour");
    }

    expect(playheadMaskRoot(scrollContainer())).toBe(maskRootElement());
  });

  describe("invariants", () => {
    // Tailwind utility CSS is not loaded here, so the class is the only witness to display: contents.
    it("generates no layout box of its own", async () => {
      seedTimeline();
      await render(<TimelinePanel />);

      expect(maskRootElement().classList.contains("contents")).toBe(true);
    });

    it("falls back to the document for a scroll container outside any marked root", async () => {
      const orphan = document.createElement("div");
      document.body.appendChild(orphan);

      expect(playheadMaskRoot(orphan)).toBe(document);
      orphan.remove();
    });
  });
});

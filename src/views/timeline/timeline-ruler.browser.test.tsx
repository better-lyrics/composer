import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { formatTime } from "@/utils/format-time";
import { rulerLabelTimes, rulerStep } from "@/views/timeline/ruler-labels";
import { TimelinePanel } from "@/views/timeline/timeline-panel";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { scrollView } from "@/views/timeline/view-scroll";
import { beforeEach, describe, expect, it } from "vitest";

// -- Constants -----------------------------------------------------------------

const DURATION = 3600;
const ZOOM = 100;
const PANEL_WIDTH = 800;

// -- Helpers -------------------------------------------------------------------

function scrollContainer(): HTMLDivElement {
  const container = document.querySelector<HTMLDivElement>("[data-scroll-container]");
  if (!container) throw new Error("scroll container not mounted");
  return container;
}

function rulerLabels(): { text: string; left: number }[] {
  const track = document.querySelector(".will-change-\\[translate\\]");
  if (!track) throw new Error("ruler track not mounted");
  return Array.from(track.querySelectorAll<HTMLSpanElement>("span.font-mono"))
    .filter((span) => !span.hidden)
    .map((span) => ({ text: span.textContent ?? "", left: Number.parseFloat(span.style.left) }));
}

function nextScrollEvent(container: HTMLElement): Promise<{ text: string; left: number }[]> {
  return new Promise((resolve) => {
    container.addEventListener("scroll", () => resolve(rulerLabels()), { once: true });
  });
}

// -- Tests ---------------------------------------------------------------------

describe("TimelineRuler", () => {
  beforeEach(() => {
    useAudioStore.setState({
      source: { type: "file", file: createAudioFile() },
      duration: DURATION,
      currentTime: 0,
      isPlaying: false,
      audioElement: null,
    });
    useProjectStore.setState({
      activeTab: "timeline",
      lines: [createLine({ text: "first", words: [createWord({ text: "first", begin: 1, end: 2 })] })],
    });
    useTimelineStore.setState({ zoom: ZOOM, scrollLeft: 0 });
  });

  it("regression: labels for the view are in the DOM in the scroll event of a far jump", async () => {
    await render(
      <div style={{ width: PANEL_WIDTH, height: 600 }}>
        <TimelinePanel />
      </div>,
    );
    const container = scrollContainer();
    container.style.width = `${PANEL_WIDTH}px`;
    container.style.overflow = "auto";
    await expect.poll(() => rulerLabels().length).toBeGreaterThan(0);

    const laneWidth = PANEL_WIDTH - GUTTER_WIDTH;
    const target = 8 * laneWidth + 123;
    const labelsAtScroll = nextScrollEvent(container);
    scrollView(container, target);
    const labels = await labelsAtScroll;

    const [labelled] = rulerStep(ZOOM);
    const visible = rulerLabelTimes(DURATION, labelled).filter(
      (time) => time * ZOOM >= target && time * ZOOM <= target + laneWidth,
    );
    expect(visible.length).toBeGreaterThan(0);
    expect(labels).toEqual(
      expect.arrayContaining(visible.map((time) => ({ text: formatTime(time, 0), left: time * ZOOM }))),
    );
    for (const label of labels) expect(label.text).toBe(formatTime(label.left / ZOOM, 0));
  });
});

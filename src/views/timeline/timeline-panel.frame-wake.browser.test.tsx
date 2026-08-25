import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { subscribeFrame } from "@/lib/frame-loop";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine, createWord } from "@/test/factories";
import { settleFrames } from "@/test/frame-steps";
import { render } from "@/test/render";
import { TimelinePanel } from "@/views/timeline/timeline-panel";

// -- Harness -------------------------------------------------------------------

let unsubscribeProbe: (() => void) | null = null;
let frames = 0;

function seedTimeline(): void {
  useAudioStore.setState({ source: { type: "file", file: createAudioFile() }, duration: 60 });
  useProjectStore.setState({
    activeTab: "timeline",
    lines: Array.from({ length: 12 }, (_, i) =>
      createLine({
        id: `line-${i}`,
        text: `lyric ${i}`,
        words: [createWord({ text: `lyric${i}`, begin: i, end: i + 0.5 })],
      }),
    ),
  });
}

function scrollContainer(): HTMLDivElement {
  const container = document.querySelector<HTMLDivElement>("[data-scroll-container]");
  if (!container) throw new Error("scroll container missing");
  return container;
}

function scrollHost(): HTMLDivElement {
  const host = document.querySelector<HTMLDivElement>("[data-timeline-scroll-host]");
  if (!host) throw new Error("scroll host missing");
  return host;
}

async function quiesce(): Promise<void> {
  await settleFrames(() => frames);
  frames = 0;
}

async function wokeAfter(trigger: () => void): Promise<boolean> {
  await quiesce();
  trigger();
  await settleFrames(() => frames);
  return frames > 0;
}

beforeEach(() => {
  frames = 0;
  unsubscribeProbe = subscribeFrame(() => {
    frames += 1;
  });
});

afterEach(() => {
  unsubscribeProbe?.();
  unsubscribeProbe = null;
});

// -- Tests ---------------------------------------------------------------------

describe("TimelinePanel frame wake sources", () => {
  it("wakes the loop when the timeline scrolls vertically", async () => {
    seedTimeline();
    await render(<TimelinePanel />);
    const container = scrollContainer();
    container.style.height = "200px";

    expect(
      await wokeAfter(() => {
        container.scrollTop = 240;
      }),
    ).toBe(true);
  });

  it("wakes the loop when the scroll host resizes", async () => {
    seedTimeline();
    await render(<TimelinePanel />);
    const host = scrollHost();

    expect(
      await wokeAfter(() => {
        host.style.flex = "none";
        host.style.height = "180px";
      }),
    ).toBe(true);
  });

  describe("invariants", () => {
    it("regression #174: an idle paused timeline stops running frames", async () => {
      seedTimeline();
      await render(<TimelinePanel />);
      await quiesce();

      await settleFrames(() => frames);
      expect(frames).toBe(0);
    });
  });
});

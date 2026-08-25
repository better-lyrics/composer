import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine, createWord } from "@/test/factories";
import { createFrameProbe, type FrameProbe } from "@/test/frame-probe";
import { settleFrames } from "@/test/frame-steps";
import { render } from "@/test/render";
import { TimelinePanel } from "@/views/timeline/timeline-panel";

// -- Harness -------------------------------------------------------------------

let probe: FrameProbe;

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

beforeEach(() => {
  probe = createFrameProbe();
});

afterEach(() => {
  probe.dispose();
});

// -- Tests ---------------------------------------------------------------------

describe("TimelinePanel frame wake sources", () => {
  it("wakes the loop when the timeline scrolls vertically", async () => {
    seedTimeline();
    await render(<TimelinePanel />);
    const container = scrollContainer();
    container.style.height = "200px";

    expect(
      await probe.wokeAfter(() => {
        container.scrollTop = 240;
      }),
    ).toBe(true);
  });

  it("wakes the loop when the scroll host resizes", async () => {
    seedTimeline();
    await render(<TimelinePanel />);
    const host = scrollHost();

    expect(
      await probe.wokeAfter(() => {
        host.style.flex = "none";
        host.style.height = "180px";
      }),
    ).toBe(true);
  });

  describe("invariants", () => {
    it("regression #174: an idle paused timeline stops running frames", async () => {
      seedTimeline();
      await render(<TimelinePanel />);
      await probe.quiesce();

      await settleFrames(probe.count);
      expect(probe.count()).toBe(0);
    });
  });
});

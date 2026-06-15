import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { TimelinePanel } from "@/views/timeline/timeline-panel";
import { TimelinePlayhead } from "@/views/timeline/timeline-playhead";
import { TimelineRows } from "@/views/timeline/timeline-rows";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useEffect, useRef } from "react";
import { beforeEach, describe, expect, it } from "vitest";

// -- Types ---------------------------------------------------------------------

interface HarnessApi {
  container: HTMLDivElement;
}

interface HarnessProps {
  onReady: (api: HarnessApi) => void;
  initialScrollTop: number;
  initialScrollLeft: number;
}

// -- Components ----------------------------------------------------------------

const RowsHarness: React.FC<HarnessProps> = ({ onReady, initialScrollTop, initialScrollLeft }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = initialScrollTop;
    el.scrollLeft = initialScrollLeft;
    onReady({ container: el });
  }, [initialScrollTop, initialScrollLeft, onReady]);
  return (
    <div ref={ref} style={{ width: 600, height: 300, overflow: "auto" }} data-testid="scroll-host">
      <TimelineRows scrollContainerRef={ref} />
    </div>
  );
};

const RowsAndPlayheadHarness: React.FC<HarnessProps> = ({ onReady, initialScrollTop, initialScrollLeft }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = initialScrollTop;
    el.scrollLeft = initialScrollLeft;
    onReady({ container: el });
  }, [initialScrollTop, initialScrollLeft, onReady]);
  return (
    <div style={{ position: "relative", width: 600, height: 300 }}>
      <div ref={ref} style={{ width: 600, height: 300, overflow: "auto" }} data-testid="scroll-host">
        <TimelineRows scrollContainerRef={ref} />
      </div>
      <TimelinePlayhead containerHeight={300} scrollContainerRef={ref} />
    </div>
  );
};

// -- Helpers -------------------------------------------------------------------

function seedManyLines(count: number) {
  const lines = Array.from({ length: count }, (_, i) =>
    createLine({ text: `line ${i + 1}`, begin: i * 2, end: i * 2 + 2 }),
  );
  useProjectStore.setState({ lines });
}

// -- Tests ---------------------------------------------------------------------

describe("Timeline zoom scrollTop preservation", () => {
  beforeEach(() => {
    useAudioStore.setState({ duration: 120, currentTime: 0, isPlaying: false, audioElement: null });
    useTimelineStore.setState({ zoom: 100, followEnabled: true, scrollLeft: 0 });
  });

  describe("happy paths", () => {
    it("setZoom alone does not move scrollTop when paused with Follow on", async () => {
      seedManyLines(50);
      let api!: HarnessApi;
      await render(
        <RowsHarness
          initialScrollTop={400}
          initialScrollLeft={0}
          onReady={(a) => {
            api = a;
          }}
        />,
      );
      await expect.poll(() => api).toBeDefined();
      await expect.poll(() => api.container.scrollTop).toBe(400);

      useTimelineStore.getState().setZoom(120);

      await expect.poll(() => useTimelineStore.getState().zoom).toBe(120);
      expect(api.container.scrollTop).toBe(400);
    });

    it("setZoom alone does not move scrollTop on zoom out", async () => {
      seedManyLines(50);
      let api!: HarnessApi;
      await render(
        <RowsHarness
          initialScrollTop={400}
          initialScrollLeft={0}
          onReady={(a) => {
            api = a;
          }}
        />,
      );
      await expect.poll(() => api).toBeDefined();
      await expect.poll(() => api.container.scrollTop).toBe(400);

      useTimelineStore.getState().setZoom(80);

      await expect.poll(() => useTimelineStore.getState().zoom).toBe(80);
      expect(api.container.scrollTop).toBe(400);
    });
  });

  describe("edge cases", () => {
    it("scrollTop=0 stays at 0 after zoom", async () => {
      seedManyLines(50);
      let api!: HarnessApi;
      await render(
        <RowsHarness
          initialScrollTop={0}
          initialScrollLeft={0}
          onReady={(a) => {
            api = a;
          }}
        />,
      );
      await expect.poll(() => api).toBeDefined();

      useTimelineStore.getState().setZoom(140);

      await expect.poll(() => useTimelineStore.getState().zoom).toBe(140);
      expect(api.container.scrollTop).toBe(0);
    });

    it("preserves scrollTop with very small line count (no vertical overflow)", async () => {
      seedManyLines(2);
      let api!: HarnessApi;
      await render(
        <RowsHarness
          initialScrollTop={0}
          initialScrollLeft={0}
          onReady={(a) => {
            api = a;
          }}
        />,
      );
      await expect.poll(() => api).toBeDefined();

      useTimelineStore.getState().setZoom(200);

      await expect.poll(() => useTimelineStore.getState().zoom).toBe(200);
      expect(api.container.scrollTop).toBe(0);
    });

    it("preserves scrollTop when scrolled past the active row (followEnabled, paused)", async () => {
      seedManyLines(50);
      useAudioStore.setState({ currentTime: 4 });
      let api!: HarnessApi;
      await render(
        <RowsHarness
          initialScrollTop={600}
          initialScrollLeft={0}
          onReady={(a) => {
            api = a;
          }}
        />,
      );
      await expect.poll(() => api).toBeDefined();
      await expect.poll(() => api.container.scrollTop).toBe(600);

      useTimelineStore.getState().setZoom(120);

      await expect.poll(() => useTimelineStore.getState().zoom).toBe(120);
      expect(api.container.scrollTop).toBe(600);
    });
  });

  describe("invariants", () => {
    it("scrollTop does not change across repeated zoom+/- toggles", async () => {
      seedManyLines(50);
      let api!: HarnessApi;
      await render(
        <RowsHarness
          initialScrollTop={300}
          initialScrollLeft={0}
          onReady={(a) => {
            api = a;
          }}
        />,
      );
      await expect.poll(() => api).toBeDefined();

      const before = api.container.scrollTop;
      useTimelineStore.getState().setZoom(120);
      await expect.poll(() => useTimelineStore.getState().zoom).toBe(120);
      useTimelineStore.getState().setZoom(100);
      await expect.poll(() => useTimelineStore.getState().zoom).toBe(100);
      useTimelineStore.getState().setZoom(80);
      await expect.poll(() => useTimelineStore.getState().zoom).toBe(80);

      expect(api.container.scrollTop).toBe(before);
    });

    it("scrollTop preserved regardless of followEnabled toggle", async () => {
      seedManyLines(50);
      useTimelineStore.setState({ followEnabled: false });
      let api!: HarnessApi;
      await render(
        <RowsHarness
          initialScrollTop={350}
          initialScrollLeft={0}
          onReady={(a) => {
            api = a;
          }}
        />,
      );
      await expect.poll(() => api).toBeDefined();

      useTimelineStore.getState().setZoom(140);

      await expect.poll(() => useTimelineStore.getState().zoom).toBe(140);
      expect(api.container.scrollTop).toBe(350);
    });
  });

  describe("regressions", () => {
    it("regression: zoom button click does not snap viewport back to the active row when paused", async () => {
      seedManyLines(50);
      useAudioStore.setState({ currentTime: 0 });
      useTimelineStore.setState({ followEnabled: true });
      let api!: HarnessApi;
      await render(
        <RowsHarness
          initialScrollTop={500}
          initialScrollLeft={0}
          onReady={(a) => {
            api = a;
          }}
        />,
      );
      await expect.poll(() => api).toBeDefined();

      useTimelineStore.getState().setZoom(120);

      await expect.poll(() => useTimelineStore.getState().zoom).toBe(120);
      expect(api.container.scrollTop).toBe(500);
    });

    it("regression: setZoom + scrollLeft mutation does not move scrollTop", async () => {
      seedManyLines(50);
      let api!: HarnessApi;
      await render(
        <RowsHarness
          initialScrollTop={400}
          initialScrollLeft={200}
          onReady={(a) => {
            api = a;
          }}
        />,
      );
      await expect.poll(() => api).toBeDefined();

      useTimelineStore.getState().setZoom(140);
      api.container.scrollLeft = 350;

      await expect.poll(() => useTimelineStore.getState().zoom).toBe(140);
      expect(api.container.scrollTop).toBe(400);
    });
  });

  describe("full TimelinePanel (paused, Follow on, off-screen active row)", () => {
    function seedFullPanel(lineCount: number, currentTime: number): void {
      useAudioStore.setState({
        source: { type: "file", file: createAudioFile() },
        duration: 120,
        currentTime,
        isPlaying: false,
      });
      useProjectStore.setState({
        activeTab: "timeline",
        lines: Array.from({ length: lineCount }, (_, i) =>
          createLine({
            id: `line-${i}`,
            text: `lyric ${i}`,
            words: [createWord({ text: `w${i}`, begin: i, end: i + 0.5 })],
          }),
        ),
      });
      useTimelineStore.setState({ zoom: 100, followEnabled: true });
    }

    function getScrollContainer(): HTMLDivElement {
      return document.querySelector("[data-scroll-container]") as HTMLDivElement;
    }

    function makePanelScrollable(container: HTMLDivElement): void {
      container.style.height = "300px";
      container.style.overflow = "auto";
      // Tailwind utility CSS isn't loaded in the browser test env. Mirror the
      // production overflow-anchor-none rule so we test the same browser behavior.
      container.style.overflowAnchor = "none";
    }

    it("regression: setZoom does not snap scrollTop when active row is off-screen", async () => {
      seedFullPanel(50, 4);
      await render(<TimelinePanel />);
      const container = getScrollContainer();
      makePanelScrollable(container);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      container.scrollTop = 600;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      expect(container.scrollTop).toBe(600);

      useTimelineStore.getState().setZoom(120);
      await expect.poll(() => useTimelineStore.getState().zoom).toBe(120);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      expect(container.scrollTop).toBe(600);
    });

    it("regression: zoom out via store does not snap scrollTop when active row is off-screen", async () => {
      seedFullPanel(50, 4);
      await render(<TimelinePanel />);
      const container = getScrollContainer();
      makePanelScrollable(container);
      container.scrollTop = 700;
      await expect.poll(() => container.scrollTop).toBe(700);

      useTimelineStore.getState().setZoom(80);
      await expect.poll(() => useTimelineStore.getState().zoom).toBe(80);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      expect(container.scrollTop).toBe(700);
    });

    it("regression: Cmd+wheel zoom does not snap scrollTop when active row is off-screen", async () => {
      seedFullPanel(50, 4);
      await render(<TimelinePanel />);
      const container = getScrollContainer();
      makePanelScrollable(container);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      container.scrollTop = 600;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      expect(container.scrollTop).toBe(600);

      const rect = container.getBoundingClientRect();
      const event = new WheelEvent("wheel", {
        deltaY: -50,
        clientX: rect.left + 200,
        clientY: rect.top + 200,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      container.dispatchEvent(event);

      await expect.poll(() => useTimelineStore.getState().zoom).not.toBe(100);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      expect(container.scrollTop).toBe(600);
    });

    it("regression: Header zoom-in button click does not snap scrollTop when active row is off-screen", async () => {
      seedFullPanel(50, 4);
      const screen = await render(<TimelinePanel />);
      const container = getScrollContainer();
      makePanelScrollable(container);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      container.scrollTop = 600;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      expect(container.scrollTop).toBe(600);

      await screen.getByRole("button", { name: "Zoom in" }).click();

      await expect.poll(() => useTimelineStore.getState().zoom).toBe(120);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      expect(container.scrollTop).toBe(600);
    });

    it("regression: scrollTop stays put with audio + waveform mounted across multiple zoom clicks", async () => {
      seedFullPanel(50, 4);
      const audio = new Audio();
      audio.src = URL.createObjectURL(new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46])], { type: "audio/wav" }));
      useAudioStore.setState({ audioElement: audio, duration: 120, currentTime: 4, isPlaying: false });
      const screen = await render(<TimelinePanel />);
      const container = getScrollContainer();
      makePanelScrollable(container);
      await new Promise((r) => setTimeout(r, 100));
      container.scrollTop = 600;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      expect(container.scrollTop).toBe(600);

      await screen.getByRole("button", { name: "Zoom in" }).click();
      await screen.getByRole("button", { name: "Zoom in" }).click();
      await screen.getByRole("button", { name: "Zoom in" }).click();

      await expect.poll(() => useTimelineStore.getState().zoom).toBe(160);
      await new Promise((r) => setTimeout(r, 100));

      expect(container.scrollTop).toBe(600);
    });

    it("regression: scroll container ships with overflow-anchor-none utility to defeat browser scroll anchoring", async () => {
      seedFullPanel(50, 4);
      await render(<TimelinePanel />);
      const container = getScrollContainer();
      expect(container.className).toContain("overflow-anchor-none");
    });
  });

  describe("with TimelinePlayhead mounted", () => {
    it("scrollTop preserved when paused, Follow on, active row off-screen, zoom changes", async () => {
      seedManyLines(50);
      useAudioStore.setState({ duration: 120, currentTime: 4, isPlaying: false, audioElement: null });
      useTimelineStore.setState({ followEnabled: true, zoom: 100 });
      let api!: HarnessApi;
      await render(
        <RowsAndPlayheadHarness
          initialScrollTop={600}
          initialScrollLeft={0}
          onReady={(a) => {
            api = a;
          }}
        />,
      );
      await expect.poll(() => api).toBeDefined();
      await expect.poll(() => api.container.scrollTop).toBe(600);

      useTimelineStore.getState().setZoom(120);
      api.container.scrollLeft = 100;

      await expect.poll(() => useTimelineStore.getState().zoom).toBe(120);
      // Give the playhead RAF a few frames to react.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      expect(api.container.scrollTop).toBe(600);
    });

    it("scrollTop preserved when paused, Follow off, active row off-screen, zoom changes", async () => {
      seedManyLines(50);
      useAudioStore.setState({ duration: 120, currentTime: 4, isPlaying: false, audioElement: null });
      useTimelineStore.setState({ followEnabled: false, zoom: 100 });
      let api!: HarnessApi;
      await render(
        <RowsAndPlayheadHarness
          initialScrollTop={600}
          initialScrollLeft={0}
          onReady={(a) => {
            api = a;
          }}
        />,
      );
      await expect.poll(() => api).toBeDefined();

      useTimelineStore.getState().setZoom(120);
      api.container.scrollLeft = 100;

      await expect.poll(() => useTimelineStore.getState().zoom).toBe(120);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      expect(api.container.scrollTop).toBe(600);
    });
  });

  describe("layout-change scroll anchoring (catches future overflow-anchor regressions)", () => {
    function seedFullPanel(lineCount: number, currentTime: number): void {
      useAudioStore.setState({
        source: { type: "file", file: createAudioFile() },
        duration: 120,
        currentTime,
        isPlaying: false,
      });
      useProjectStore.setState({
        activeTab: "timeline",
        lines: Array.from({ length: lineCount }, (_, i) =>
          createLine({
            id: `line-${i}`,
            text: `lyric ${i}`,
            words: [createWord({ text: `w${i}`, begin: i, end: i + 0.5 })],
          }),
        ),
      });
      useTimelineStore.setState({ zoom: 100, followEnabled: true });
    }

    function getScrollContainer(): HTMLDivElement {
      return document.querySelector("[data-scroll-container]") as HTMLDivElement;
    }

    function makePanelScrollable(container: HTMLDivElement): void {
      container.style.height = "300px";
      container.style.overflow = "auto";
      container.style.overflowAnchor = "none";
    }

    it("appending lines above the viewport does not shift scrollTop", async () => {
      seedFullPanel(50, 4);
      await render(<TimelinePanel />);
      const container = getScrollContainer();
      makePanelScrollable(container);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      container.scrollTop = 600;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      useProjectStore.setState((s) => ({
        lines: [
          createLine({
            id: "prepended",
            text: "new line at top",
            words: [createWord({ text: "n", begin: 0, end: 1 })],
          }),
          ...s.lines,
        ],
      }));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      expect(container.scrollTop).toBe(600);
    });

    it("changing a row's height above the viewport does not shift scrollTop", async () => {
      seedFullPanel(50, 4);
      await render(<TimelinePanel />);
      const container = getScrollContainer();
      makePanelScrollable(container);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      container.scrollTop = 600;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      useTimelineStore.getState().setRowHeight("line-0", 100);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      expect(container.scrollTop).toBe(600);
    });

    it("toggling Follow does not shift scrollTop when paused", async () => {
      seedFullPanel(50, 4);
      await render(<TimelinePanel />);
      const container = getScrollContainer();
      makePanelScrollable(container);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      container.scrollTop = 600;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      useTimelineStore.getState().toggleFollow();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      useTimelineStore.getState().toggleFollow();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      expect(container.scrollTop).toBe(600);
    });

    it("toggling Preview Sidebar does not shift scrollTop", async () => {
      seedFullPanel(50, 4);
      await render(<TimelinePanel />);
      const container = getScrollContainer();
      makePanelScrollable(container);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      container.scrollTop = 600;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      useTimelineStore.getState().togglePreviewSidebar();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      expect(container.scrollTop).toBe(600);
    });

    it("zoom-out button is disabled at MIN_ZOOM so users cannot trigger a no-op layout change", async () => {
      seedFullPanel(50, 4);
      useTimelineStore.setState({ zoom: 20 });
      const screen = await render(<TimelinePanel />);
      await expect.element(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
    });

    it("zoom-in button is disabled at MAX_ZOOM so users cannot trigger a no-op layout change", async () => {
      seedFullPanel(50, 4);
      useTimelineStore.setState({ zoom: 500 });
      const screen = await render(<TimelinePanel />);
      await expect.element(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
    });
  });
});

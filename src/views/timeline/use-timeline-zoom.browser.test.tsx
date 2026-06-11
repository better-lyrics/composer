import { useAudioStore } from "@/stores/audio";
import { render } from "@/test/render";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { useTimelineZoom } from "@/views/timeline/use-timeline-zoom";
import { useEffect, useRef } from "react";
import { beforeEach, describe, expect, it } from "vitest";

// -- Interfaces ----------------------------------------------------------------

interface HarnessApi {
  zoomIn: () => void;
  zoomOut: () => void;
  container: HTMLDivElement;
}

interface HarnessProps {
  initialZoom: number;
  initialScrollLeft: number;
  currentTime: number;
  containerWidth: number;
  contentWidth: number;
  onReady: (api: HarnessApi) => void;
}

// -- Components ----------------------------------------------------------------

const Harness: React.FC<HarnessProps> = ({
  initialZoom,
  initialScrollLeft,
  currentTime,
  containerWidth,
  contentWidth,
  onReady,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { zoomIn, zoomOut } = useTimelineZoom(ref);

  useEffect(() => {
    useTimelineStore.setState({ zoom: initialZoom });
    useAudioStore.setState({ currentTime });
    const el = ref.current;
    if (!el) return;
    el.style.overflowX = "scroll";
    el.style.width = `${containerWidth}px`;
    el.scrollLeft = initialScrollLeft;
    onReady({ zoomIn, zoomOut, container: el });
  }, [initialZoom, initialScrollLeft, currentTime, containerWidth, zoomIn, zoomOut, onReady]);

  return (
    <div ref={ref} data-testid="scroll-host">
      <div style={{ width: `${contentWidth}px`, height: 200 }} />
    </div>
  );
};

const NullRefHarness: React.FC<{ onReady: (zoomIn: () => void) => void }> = ({ onReady }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const { zoomIn } = useTimelineZoom(ref);
  useEffect(() => {
    onReady(zoomIn);
  }, [zoomIn, onReady]);
  return null;
};

// -- Tests ---------------------------------------------------------------------

describe("useTimelineZoom", () => {
  beforeEach(() => {
    useTimelineStore.setState({ zoom: 100 });
    useAudioStore.setState({ currentTime: 0, audioElement: null });
  });

  describe("playhead in view", () => {
    it("zoomIn keeps the playhead viewport-X stable", async () => {
      let api!: HarnessApi;
      await render(
        <Harness
          initialZoom={100}
          initialScrollLeft={400}
          currentTime={5}
          containerWidth={800}
          contentWidth={5000}
          onReady={(a) => {
            api = a;
          }}
        />,
      );
      await expect.poll(() => api).toBeDefined();
      const beforePlayheadX = 5 * 100 - api.container.scrollLeft;
      api.zoomIn();
      await expect.poll(() => useTimelineStore.getState().zoom).toBe(120);
      const afterPlayheadX = 5 * 120 - api.container.scrollLeft;
      expect(afterPlayheadX).toBeCloseTo(beforePlayheadX, 0);
    });

    it("zoomOut keeps the playhead viewport-X stable", async () => {
      let api!: HarnessApi;
      await render(
        <Harness
          initialZoom={100}
          initialScrollLeft={400}
          currentTime={5}
          containerWidth={800}
          contentWidth={5000}
          onReady={(a) => {
            api = a;
          }}
        />,
      );
      await expect.poll(() => api).toBeDefined();
      const beforePlayheadX = 5 * 100 - api.container.scrollLeft;
      api.zoomOut();
      await expect.poll(() => useTimelineStore.getState().zoom).toBe(80);
      const afterPlayheadX = 5 * 80 - api.container.scrollLeft;
      expect(afterPlayheadX).toBeCloseTo(beforePlayheadX, 0);
    });
  });

  describe("playhead off-screen", () => {
    it("falls back to viewport center when playhead is far to the right of viewport", async () => {
      let api!: HarnessApi;
      await render(
        <Harness
          initialZoom={100}
          initialScrollLeft={0}
          currentTime={50}
          containerWidth={400}
          contentWidth={10000}
          onReady={(a) => {
            api = a;
          }}
        />,
      );
      await expect.poll(() => api).toBeDefined();
      const contentWidthInView = 400 - GUTTER_WIDTH;
      const centerViewportX = contentWidthInView / 2;
      const anchorTime = (centerViewportX + 0) / 100;
      api.zoomIn();
      await expect.poll(() => useTimelineStore.getState().zoom).toBe(120);
      expect(api.container.scrollLeft).toBeCloseTo(anchorTime * 120 - centerViewportX, 0);
    });

    it("falls back to viewport center when playhead is far to the left of viewport", async () => {
      let api!: HarnessApi;
      await render(
        <Harness
          initialZoom={100}
          initialScrollLeft={4000}
          currentTime={1}
          containerWidth={400}
          contentWidth={10000}
          onReady={(a) => {
            api = a;
          }}
        />,
      );
      await expect.poll(() => api).toBeDefined();
      const contentWidthInView = 400 - GUTTER_WIDTH;
      const centerViewportX = contentWidthInView / 2;
      const anchorTime = (centerViewportX + 4000) / 100;
      api.zoomOut();
      await expect.poll(() => useTimelineStore.getState().zoom).toBe(80);
      expect(api.container.scrollLeft).toBeCloseTo(Math.max(0, anchorTime * 80 - centerViewportX), 0);
    });
  });

  describe("zoom clamps", () => {
    it("zoomIn is a no-op at MAX_ZOOM and leaves scroll alone", async () => {
      let api!: HarnessApi;
      await render(
        <Harness
          initialZoom={500}
          initialScrollLeft={123}
          currentTime={5}
          containerWidth={400}
          contentWidth={5000}
          onReady={(a) => {
            api = a;
          }}
        />,
      );
      await expect.poll(() => api).toBeDefined();
      api.zoomIn();
      expect(useTimelineStore.getState().zoom).toBe(500);
      expect(api.container.scrollLeft).toBe(123);
    });

    it("zoomOut is a no-op at MIN_ZOOM and leaves scroll alone", async () => {
      let api!: HarnessApi;
      await render(
        <Harness
          initialZoom={20}
          initialScrollLeft={50}
          currentTime={5}
          containerWidth={400}
          contentWidth={5000}
          onReady={(a) => {
            api = a;
          }}
        />,
      );
      await expect.poll(() => api).toBeDefined();
      api.zoomOut();
      expect(useTimelineStore.getState().zoom).toBe(20);
      expect(api.container.scrollLeft).toBe(50);
    });
  });

  describe("regressions", () => {
    it("regression: currentTime=0 scrollLeft=0 stays at 0 after zoom", async () => {
      let api!: HarnessApi;
      await render(
        <Harness
          initialZoom={100}
          initialScrollLeft={0}
          currentTime={0}
          containerWidth={400}
          contentWidth={5000}
          onReady={(a) => {
            api = a;
          }}
        />,
      );
      await expect.poll(() => api).toBeDefined();
      api.zoomIn();
      await expect.poll(() => useTimelineStore.getState().zoom).toBe(120);
      expect(api.container.scrollLeft).toBe(0);
    });

    it("regression: prefers audioElement.currentTime over store currentTime when both present", async () => {
      let api!: HarnessApi;
      const fakeAudio = { currentTime: 7 } as HTMLAudioElement;
      useAudioStore.setState({ audioElement: fakeAudio, currentTime: 0 });
      await render(
        <Harness
          initialZoom={100}
          initialScrollLeft={400}
          currentTime={0}
          containerWidth={800}
          contentWidth={5000}
          onReady={(a) => {
            api = a;
          }}
        />,
      );
      await expect.poll(() => api).toBeDefined();
      const beforePlayheadX = 7 * 100 - api.container.scrollLeft;
      api.zoomIn();
      await expect.poll(() => useTimelineStore.getState().zoom).toBe(120);
      const afterPlayheadX = 7 * 120 - api.container.scrollLeft;
      expect(afterPlayheadX).toBeCloseTo(beforePlayheadX, 0);
    });
  });

  describe("null scroll container", () => {
    it("still updates zoom and does not throw", async () => {
      let zoomIn!: () => void;
      await render(
        <NullRefHarness
          onReady={(z) => {
            zoomIn = z;
          }}
        />,
      );
      await expect.poll(() => zoomIn).toBeDefined();
      expect(() => zoomIn()).not.toThrow();
      expect(useTimelineStore.getState().zoom).toBe(120);
    });
  });
});

import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { subscribeFrame } from "@/lib/frame-loop";
import { settleFrames } from "@/test/frame-steps";
import { render } from "@/test/render";
import { useTimelineFrameWake } from "@/views/timeline/use-timeline-frame-wake";

// -- Interfaces ----------------------------------------------------------------

interface WakeProbeProps {
  enabled?: boolean;
}

// -- Harness -------------------------------------------------------------------

const WakeProbe: React.FC<WakeProbeProps> = ({ enabled = true }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useTimelineFrameWake(scrollContainerRef, contentRef, enabled);
  return (
    <div ref={contentRef} data-test="content" style={{ position: "relative", width: 400, height: 200 }}>
      <div ref={scrollContainerRef} data-test="scroll" style={{ position: "absolute", inset: 0, overflow: "auto" }}>
        <div style={{ width: 2000, height: 1200 }} />
      </div>
    </div>
  );
};

let unsubscribeProbe: (() => void) | null = null;
let frames = 0;

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

function scrollContainer(root: HTMLElement): HTMLDivElement {
  const container = root.querySelector<HTMLDivElement>("[data-test='scroll']");
  if (!container) throw new Error("scroll container missing");
  return container;
}

function contentElement(root: HTMLElement): HTMLDivElement {
  const content = root.querySelector<HTMLDivElement>("[data-test='content']");
  if (!content) throw new Error("content element missing");
  return content;
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

describe("useTimelineFrameWake", () => {
  it("wakes the loop on vertical scroll", async () => {
    const screen = await render(<WakeProbe />);
    const container = scrollContainer(screen.container);
    expect(
      await wokeAfter(() => {
        container.scrollTop = 300;
      }),
    ).toBe(true);
  });

  it("wakes the loop on horizontal scroll", async () => {
    const screen = await render(<WakeProbe />);
    const container = scrollContainer(screen.container);
    expect(
      await wokeAfter(() => {
        container.scrollLeft = 300;
      }),
    ).toBe(true);
  });

  it("wakes the loop when the content element resizes", async () => {
    const screen = await render(<WakeProbe />);
    const content = contentElement(screen.container);
    expect(
      await wokeAfter(() => {
        content.style.height = "320px";
      }),
    ).toBe(true);
  });

  describe("enabled gate", () => {
    it("attaches no wake source while disabled", async () => {
      const screen = await render(<WakeProbe enabled={false} />);
      const container = scrollContainer(screen.container);
      const content = contentElement(screen.container);
      expect(
        await wokeAfter(() => {
          container.scrollTop = 300;
          content.style.height = "320px";
        }),
      ).toBe(false);
    });

    it("attaches once enabled turns on", async () => {
      const screen = await render(<WakeProbe enabled={false} />);
      const container = scrollContainer(screen.container);
      expect(
        await wokeAfter(() => {
          container.scrollTop = 300;
        }),
      ).toBe(false);

      await screen.rerender(<WakeProbe enabled={true} />);
      expect(
        await wokeAfter(() => {
          container.scrollTop = 600;
        }),
      ).toBe(true);
    });
  });

  describe("cleanup", () => {
    it("stops waking after the tree unmounts", async () => {
      const screen = await render(<WakeProbe />);
      const container = scrollContainer(screen.container);
      const content = contentElement(screen.container);
      expect(
        await wokeAfter(() => {
          container.scrollTop = 300;
        }),
      ).toBe(true);

      await screen.unmount();
      expect(
        await wokeAfter(() => {
          container.scrollTop = 600;
          content.style.height = "320px";
        }),
      ).toBe(false);
    });
  });

  describe("invariants", () => {
    it("leaves the loop quiescent when nothing moves", async () => {
      await render(<WakeProbe />);
      await quiesce();
      await settleFrames(() => frames);
      expect(frames).toBe(0);
    });
  });
});

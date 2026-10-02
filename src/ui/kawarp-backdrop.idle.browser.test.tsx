import { subscribeFrame } from "@/lib/frame-loop";
import { settleFrames, stepFrames } from "@/test/frame-steps";
import { emulateReducedMotion } from "@/test/reduced-motion";
import { render } from "@/test/render";
import { overrideVisibilityState } from "@/test/visibility";
import { KawarpBackdrop } from "@/ui/kawarp-backdrop";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const Card: React.FC = () => (
  <div style={{ width: 400, height: 240 }}>
    <KawarpBackdrop />
  </div>
);

const OffScreenCard: React.FC = () => (
  <div style={{ position: "absolute", top: 20000, left: 0, width: 400, height: 240 }}>
    <KawarpBackdrop />
  </div>
);

function countFrames(): { read: () => number; stop: () => void } {
  let frames = 0;
  const stop = subscribeFrame(() => {
    frames += 1;
  }, "kawarp-idle-test-probe");
  return { read: () => frames, stop };
}

// -- Tests --------------------------------------------------------------------

describe("KawarpBackdrop idling", () => {
  describe("reduced motion", () => {
    beforeEach(() => emulateReducedMotion("reduce"));
    afterEach(() => emulateReducedMotion("no-preference"));

    it("draws one still frame and lets the frame loop idle", async () => {
      const screen = await render(<Card />);
      await expect.poll(() => screen.container.querySelector("canvas")).not.toBeNull();
      const probe = countFrames();
      await expect(settleFrames(probe.read)).resolves.toBeTypeOf("number");
      probe.stop();
    });
  });

  it("idles once the backdrop scrolls off screen", async () => {
    const screen = await render(<OffScreenCard />);
    await expect.poll(() => screen.container.querySelector("canvas")).not.toBeNull();
    const probe = countFrames();
    await expect(settleFrames(probe.read)).resolves.toBeTypeOf("number");
    probe.stop();
  });

  it("idles while the tab is hidden", async () => {
    const screen = await render(<Card />);
    await expect.poll(() => screen.container.querySelector("canvas")).not.toBeNull();
    const probe = countFrames();
    await stepFrames(5);
    expect(probe.read()).toBeGreaterThan(0);
    const restore = overrideVisibilityState("hidden");
    try {
      document.dispatchEvent(new Event("visibilitychange"));
      await expect(settleFrames(probe.read)).resolves.toBeTypeOf("number");
    } finally {
      restore();
    }
    probe.stop();
  });
});

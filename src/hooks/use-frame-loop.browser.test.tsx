import { describe, expect, it } from "vitest";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { TAIL_FRAMES, wake } from "@/lib/frame-loop";
import { settleFrames, stepFrames } from "@/test/frame-steps";
import { render } from "@/test/render";

// -- Interfaces ---------------------------------------------------------------

interface FrameProbeProps {
  onFrame: () => void;
  enabled?: boolean;
}

// -- Constants ----------------------------------------------------------------

const IDLE_FRAMES = TAIL_FRAMES + 4;

// -- Components ---------------------------------------------------------------

const FrameProbe: React.FC<FrameProbeProps> = ({ onFrame, enabled }) => {
  useFrameLoop(onFrame, "frame-probe", enabled);
  return null;
};

// -- Tests --------------------------------------------------------------------

describe("useFrameLoop", () => {
  it("runs the callback while enabled", async () => {
    let calls = 0;
    await render(
      <FrameProbe
        onFrame={() => {
          calls += 1;
        }}
      />,
    );
    await settleFrames(() => calls);
    expect(calls).toBeGreaterThan(0);
  });

  it("uses the latest callback without resubscribing", async () => {
    let firstCalls = 0;
    let secondCalls = 0;
    const screen = await render(
      <FrameProbe
        onFrame={() => {
          firstCalls += 1;
        }}
      />,
    );
    await settleFrames(() => firstCalls);
    expect(firstCalls).toBeGreaterThan(0);

    const callsBeforeSwap = firstCalls;
    await screen.rerender(
      <FrameProbe
        onFrame={() => {
          secondCalls += 1;
        }}
      />,
    );
    await stepFrames(IDLE_FRAMES);
    expect(secondCalls).toBe(0);

    wake();
    await settleFrames(() => secondCalls);
    expect(secondCalls).toBeGreaterThan(0);
    expect(firstCalls).toBe(callsBeforeSwap);
  });

  it("never subscribes while disabled", async () => {
    let calls = 0;
    await render(
      <FrameProbe
        enabled={false}
        onFrame={() => {
          calls += 1;
        }}
      />,
    );
    wake();
    await stepFrames(IDLE_FRAMES);
    expect(calls).toBe(0);
  });

  it("subscribes and unsubscribes as enabled toggles", async () => {
    let calls = 0;
    const onFrame = () => {
      calls += 1;
    };
    const screen = await render(<FrameProbe enabled={false} onFrame={onFrame} />);
    wake();
    await stepFrames(IDLE_FRAMES);
    expect(calls).toBe(0);

    await screen.rerender(<FrameProbe enabled={true} onFrame={onFrame} />);
    await settleFrames(() => calls);
    expect(calls).toBeGreaterThan(0);

    await screen.rerender(<FrameProbe enabled={false} onFrame={onFrame} />);
    const callsWhileDisabled = calls;
    wake();
    await stepFrames(IDLE_FRAMES);
    expect(calls).toBe(callsWhileDisabled);
  });

  it("unsubscribes on unmount", async () => {
    let calls = 0;
    const screen = await render(
      <FrameProbe
        onFrame={() => {
          calls += 1;
        }}
      />,
    );
    await settleFrames(() => calls);
    expect(calls).toBeGreaterThan(0);

    await screen.unmount();
    const callsAtUnmount = calls;
    wake();
    await stepFrames(IDLE_FRAMES);
    expect(calls).toBe(callsAtUnmount);
  });
});

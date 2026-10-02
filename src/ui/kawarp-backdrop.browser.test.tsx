import { subscribeFrame } from "@/lib/frame-loop";
import { allowConsole } from "@/test/console-guard";
import { settleFrames, stepFrames } from "@/test/frame-steps";
import { render } from "@/test/render";
import { KawarpBackdrop } from "@/ui/kawarp-backdrop";
import { describe, expect, it, vi } from "vitest";

// -- Helpers ------------------------------------------------------------------

const Card: React.FC<{ src?: string }> = ({ src }) => (
  <div style={{ width: 400, height: 240 }}>
    <KawarpBackdrop src={src} />
  </div>
);

function countFrames(): { read: () => number; stop: () => void } {
  let frames = 0;
  const stop = subscribeFrame(() => {
    frames += 1;
  }, "kawarp-test-probe");
  return { read: () => frames, stop };
}

// -- Tests --------------------------------------------------------------------

describe("KawarpBackdrop", () => {
  it("draws into its own canvas with an opaque WebGL context", async () => {
    const screen = await render(<Card />);
    await expect.poll(() => screen.container.querySelector("canvas")).not.toBeNull();
    const canvas = screen.container.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas.getContext("webgl")?.getContextAttributes()?.alpha).toBe(false);
  });

  it("is hidden from assistive technology", async () => {
    const screen = await render(<Card />);
    await expect.poll(() => screen.container.querySelector("canvas")).not.toBeNull();
    expect(screen.container.querySelector("canvas")?.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("keeps the frame loop running while it is on screen", async () => {
    await render(<Card />);
    const probe = countFrames();
    await stepFrames(30);
    expect(probe.read()).toBeGreaterThanOrEqual(25);
    probe.stop();
  });

  it("lets the frame loop idle and removes its canvas once unmounted", async () => {
    const screen = await render(<Card />);
    await expect.poll(() => screen.container.querySelector("canvas")).not.toBeNull();
    await screen.unmount();
    expect(document.querySelector("canvas")).toBeNull();
    const probe = countFrames();
    await expect(settleFrames(probe.read)).resolves.toBeTypeOf("number");
    probe.stop();
  });

  it("mounts a fresh canvas each time it mounts", async () => {
    const screen = await render(<Card key="first" />);
    await expect.poll(() => screen.container.querySelector("canvas")).not.toBeNull();
    const first = screen.container.querySelector("canvas");
    await screen.rerender(<Card key="second" />);
    await expect.poll(() => screen.container.querySelector("canvas")).not.toBe(first);
    expect(screen.container.querySelectorAll("canvas")).toHaveLength(1);
  });

  describe("error paths", () => {
    it("falls back to the gradient when the cover art cannot load", async () => {
      allowConsole(/could not load the cover art/);
      const warn = vi.spyOn(console, "warn");
      await render(<Card src="data:image/png;base64,AAAA" />);
      await expect
        .poll(() =>
          warn.mock.calls.some((args) => args.some((arg) => String(arg).includes("could not load the cover art"))),
        )
        .toBe(true);
      warn.mockRestore();
    });
  });
});

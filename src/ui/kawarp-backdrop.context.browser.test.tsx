import { allowConsole } from "@/test/console-guard";
import { stepFrames } from "@/test/frame-steps";
import { render } from "@/test/render";
import { KawarpBackdrop } from "@/ui/kawarp-backdrop";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const Card: React.FC = () => (
  <div style={{ width: 400, height: 240 }}>
    <KawarpBackdrop />
  </div>
);

const MOUNT_CYCLES = 20;

// -- Tests --------------------------------------------------------------------

describe("KawarpBackdrop WebGL context lifecycle", () => {
  describe("regressions", () => {
    it("regression: releases the WebGL context on its own unmount instead of waiting for the browser to evict it", async () => {
      const screen = await render(<Card />);
      await expect.poll(() => screen.container.querySelector("canvas")).not.toBeNull();
      const canvas = screen.container.querySelector("canvas") as HTMLCanvasElement;
      const context = canvas.getContext("webgl");
      await screen.unmount();
      expect(context?.isContextLost()).toBe(true);
    });

    it("regression: mounting repeatedly never leaks a live context past its own unmount", async () => {
      for (let mountIndex = 0; mountIndex < MOUNT_CYCLES; mountIndex++) {
        const screen = await render(<Card key={mountIndex} />);
        await expect.poll(() => screen.container.querySelector("canvas")).not.toBeNull();
        const canvas = screen.container.querySelector("canvas") as HTMLCanvasElement;
        const context = canvas.getContext("webgl");
        await screen.unmount();
        expect(context?.isContextLost()).toBe(true);
      }
    });

    it("regression: rebuilds after a real context loss and restoration instead of staying dark", async () => {
      allowConsole(/WebGL context lost/);
      const screen = await render(<Card />);
      await expect.poll(() => screen.container.querySelector("canvas")).not.toBeNull();
      const canvas = screen.container.querySelector("canvas") as HTMLCanvasElement;
      const gl = canvas.getContext("webgl") as WebGLRenderingContext;
      const loseContext = gl.getExtension("WEBGL_lose_context");
      expect(loseContext).not.toBeNull();

      const lost = new Promise<void>((resolve) =>
        canvas.addEventListener("webglcontextlost", () => resolve(), { once: true }),
      );
      loseContext?.loseContext();
      await lost;
      expect(gl.isContextLost()).toBe(true);
      await stepFrames(1);

      loseContext?.restoreContext();
      await expect.poll(() => gl.isContextLost(), { timeout: 5000 }).toBe(false);
      await expect.poll(() => canvas.getContext("webgl")?.getContextAttributes()?.alpha).toBe(false);
    });
  });
});

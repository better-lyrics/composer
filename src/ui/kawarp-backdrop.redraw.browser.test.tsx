import { allowConsole } from "@/test/console-guard";
import { stepFrames } from "@/test/frame-steps";
import { emulateReducedMotion } from "@/test/reduced-motion";
import { render } from "@/test/render";
import { KawarpBackdrop } from "@/ui/kawarp-backdrop";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// -- Constants ----------------------------------------------------------------

const BROKEN_IMAGE_SRC = "data:image/png;base64,AAAA";

// -- Helpers ------------------------------------------------------------------

const Card: React.FC<{ src?: string }> = ({ src }) => (
  <div style={{ width: 400, height: 240 }}>
    <KawarpBackdrop src={src} />
  </div>
);

function solidColorDataUrl(color: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 4;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable in test");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 4, 4);
  return canvas.toDataURL("image/png");
}

function readCenterPixel(canvas: HTMLCanvasElement): Uint8Array {
  const gl = canvas.getContext("webgl") as WebGLRenderingContext;
  const pixel = new Uint8Array(4);
  gl.readPixels(canvas.width >> 1, canvas.height >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  return pixel;
}

function brightness(canvas: HTMLCanvasElement): number {
  const [red, green, blue] = readCenterPixel(canvas);
  return red + green + blue;
}

function isRed(canvas: HTMLCanvasElement): boolean {
  const [red, green, blue] = readCenterPixel(canvas);
  return red > 150 && red > green && red > blue;
}

async function paintedCanvas(container: HTMLElement): Promise<HTMLCanvasElement> {
  await expect.poll(() => container.querySelector("canvas")).not.toBeNull();
  const canvas = container.querySelector("canvas") as HTMLCanvasElement;
  await expect.poll(() => brightness(canvas)).toBeGreaterThan(0);
  return canvas;
}

async function settleFailedImageLoad(src: string): Promise<void> {
  const bitmap = await fetch(src)
    .then((response) => response.blob())
    .then((blob) => createImageBitmap(blob))
    .catch((error: unknown) => error);
  if (bitmap instanceof ImageBitmap) throw new Error("expected the image to fail to decode");
  await new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });
  await stepFrames(2);
}

// Reduced motion turns Kawarp's crossfade into an instant cut, so one frame after a paint shows only the new content.
describe("KawarpBackdrop redraws while idle", () => {
  beforeAll(() => emulateReducedMotion("reduce"));
  afterAll(() => emulateReducedMotion("no-preference"));

  describe("regressions", () => {
    it("regression: redraws after a resize while idle instead of leaving the canvas blank", async () => {
      const screen = await render(<Card />);
      const canvas = await paintedCanvas(screen.container);
      canvas.style.width = "150px";
      canvas.style.height = "90px";
      await expect.poll(() => canvas.width).toBe(150);
      await expect.poll(() => brightness(canvas)).toBeGreaterThan(0);
    });

    it("regression: redraws after a src change while idle instead of leaving the canvas stale", async () => {
      const screen = await render(<Card />);
      const canvas = await paintedCanvas(screen.container);
      await screen.rerender(<Card src={solidColorDataUrl("rgb(220, 20, 20)")} />);
      await expect.poll(() => isRed(canvas)).toBe(true);
    });

    it("regression: a slow older src resolving after a newer one does not overwrite it", async () => {
      allowConsole(/could not load the cover art/);
      const screen = await render(<Card />);
      const canvas = await paintedCanvas(screen.container);
      await screen.rerender(<Card src={BROKEN_IMAGE_SRC} />);
      await screen.rerender(<Card src={solidColorDataUrl("rgb(220, 20, 20)")} />);
      await expect.poll(() => isRed(canvas)).toBe(true);
      await settleFailedImageLoad(BROKEN_IMAGE_SRC);
      expect(isRed(canvas)).toBe(true);
    });
  });
});

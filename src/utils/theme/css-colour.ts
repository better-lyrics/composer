import type { Rgb } from "@/domain/spectrum/palettes";

// -- State ---------------------------------------------------------------------

let parseContext: OffscreenCanvasRenderingContext2D | null = null;

// -- Functions -----------------------------------------------------------------

function cssVariable(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Canvas fills need concrete channels, and the canvas parser resolves color-mix() for us.
function rgbOf(css: string): Rgb {
  parseContext ??= new OffscreenCanvas(1, 1).getContext("2d", { willReadFrequently: true });
  if (!parseContext) return [0, 0, 0];
  parseContext.clearRect(0, 0, 1, 1);
  parseContext.fillStyle = "#000";
  parseContext.fillStyle = css;
  parseContext.fillRect(0, 0, 1, 1);
  const [r, g, b] = parseContext.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

// -- Exports -------------------------------------------------------------------

export { cssVariable, rgbOf };

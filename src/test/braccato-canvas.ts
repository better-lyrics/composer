import type { BraccatoLyricsElement } from "@braccato/core/element";

// Braccato 2 draws the lyrics on a WebGL canvas over an invisible layout DOM that places them, so
// a test reads what is lit off a 2D snapshot of the canvas, inside a layout element's box.

// -- Constants -----------------------------------------------------------------

// Lit text is drawn opaque; unlit text at --blyrics-inactive-opacity (0.3 by default, 0.2 in the app).
const LIT_ALPHA = 200;

// -- Helpers -------------------------------------------------------------------

function peakAlpha(el: BraccatoLyricsElement, target: Element, fraction = 1): number {
  const renderer = el.renderer;
  const snapshot = renderer?.snapshot();
  const context = snapshot?.getContext("2d");
  if (!renderer || !snapshot || !context) return 0;
  const canvasBox = renderer.canvas.getBoundingClientRect();
  const box = target.getBoundingClientRect();
  const scale = snapshot.width / canvasBox.width;
  const left = Math.max(0, Math.floor((box.left - canvasBox.left) * scale));
  const top = Math.max(0, Math.floor((box.top - canvasBox.top) * scale));
  const width = Math.min(snapshot.width - left, Math.ceil(box.width * fraction * scale));
  const height = Math.min(snapshot.height - top, Math.ceil(box.height * scale));
  if (width <= 0 || height <= 0) return 0;
  const pixels = context.getImageData(left, top, width, height).data;
  let peak = 0;
  for (let index = 3; index < pixels.length; index += 4) peak = Math.max(peak, pixels[index]);
  return peak;
}

function litLineText(el: BraccatoLyricsElement): string {
  const lit = [...el.querySelectorAll(".blyrics--line")].find((line) => peakAlpha(el, line) >= LIT_ALPHA);
  return lit?.textContent ?? "";
}

// Whether the sweep has reached the first quarter of the word.
function isWordLit(el: BraccatoLyricsElement, text: string): boolean {
  const word = [...el.querySelectorAll(".blyrics--word")].find((candidate) => candidate.textContent === text);
  return word !== undefined && peakAlpha(el, word, 0.25) >= LIT_ALPHA;
}

// -- Exports -------------------------------------------------------------------

export { isWordLit, litLineText };

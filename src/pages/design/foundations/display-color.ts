// -- Constants -----------------------------------------------------------------

const OPAQUE = 255;

// -- Functions -----------------------------------------------------------------

function hexByte(byte: number): string {
  return byte.toString(16).padStart(2, "0");
}

// Mixed tokens resolve to their color-mix() source text, so paint them once to read the color they produce.
function displayColor(value: string, context: CanvasRenderingContext2D | null): string {
  if (!context || !value.includes("color-mix(")) return value;
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
  const hex = `#${hexByte(red)}${hexByte(green)}${hexByte(blue)}`;
  return alpha === OPAQUE ? hex : `${hex}${hexByte(alpha)}`;
}

function colorProbe(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.getContext("2d", { willReadFrequently: true });
}

// -- Exports -------------------------------------------------------------------

export { colorProbe, displayColor };

// -- Functions ----------------------------------------------------------------

function sizeCanvas(canvas: HTMLCanvasElement, width: number, height: number, pixelRatio: number): void {
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);
  if (canvas.width === pixelWidth && canvas.height === pixelHeight) return;
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

// -- Exports ------------------------------------------------------------------

export { sizeCanvas };

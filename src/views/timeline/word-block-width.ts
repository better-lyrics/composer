// -- Constants -----------------------------------------------------------------

const MIN_BLOCK_WIDTH = 24;

// -- Functions -----------------------------------------------------------------

function blockWidth(naturalWidth: number): number {
  return Math.max(naturalWidth, MIN_BLOCK_WIDTH);
}

function isAtMinWidth(naturalWidth: number): boolean {
  return naturalWidth < MIN_BLOCK_WIDTH;
}

// -- Exports -------------------------------------------------------------------

export { MIN_BLOCK_WIDTH, blockWidth, isAtMinWidth };

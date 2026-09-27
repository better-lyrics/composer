// -- Constants -----------------------------------------------------------------

const PREVIEW_SIDEBAR_WIDTH = { min: 240, default: 320, max: 640 } as const;

// -- Functions -----------------------------------------------------------------

function clampPreviewSidebarWidth(px: number): number {
  if (!Number.isFinite(px)) return PREVIEW_SIDEBAR_WIDTH.default;
  return Math.round(Math.min(PREVIEW_SIDEBAR_WIDTH.max, Math.max(PREVIEW_SIDEBAR_WIDTH.min, px)));
}

// -- Exports -------------------------------------------------------------------

export { PREVIEW_SIDEBAR_WIDTH, clampPreviewSidebarWidth };

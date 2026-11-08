import { cn } from "@/utils/cn";

// -- Constants ----------------------------------------------------------------

// A field sunk slightly below the panel it sits on.
const RECESSED_TINT = "bg-[color-mix(in_oklab,var(--color-composer-bg-dark)_28%,transparent)]";

// Also overrides the centred column FileDropZone starts with.
const DROP_TILE_STYLES = cn(
  "size-auto w-full flex flex-row items-center justify-start gap-3.5 p-3.5 rounded-[10px] border-[1.5px] border-dashed text-start transition-colors",
  RECESSED_TINT,
  "border-[color-mix(in_oklab,var(--ink)_13%,transparent)] hover:border-[color-mix(in_oklab,var(--ink)_22%,transparent)]",
);

// -- Exports ------------------------------------------------------------------

export { DROP_TILE_STYLES, RECESSED_TINT };

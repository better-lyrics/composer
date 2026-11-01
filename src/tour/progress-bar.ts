import type { PopoverDOM } from "driver.js";

// -- Constants ----------------------------------------------------------------

const PROGRESS_BAR_CLASS = "composer-tour-progress-bar";

// -- Helpers ------------------------------------------------------------------

function injectProgressBar(popover: PopoverDOM, activeIndex: number | undefined, stepCount: number) {
  if (activeIndex === undefined || stepCount === 0) return;
  const bar = document.createElement("span");
  bar.className = PROGRESS_BAR_CLASS;
  const fill = document.createElement("i");
  fill.style.width = `${((activeIndex + 1) / stepCount) * 100}%`;
  bar.append(fill);
  popover.progress.prepend(bar);
}

// -- Exports ------------------------------------------------------------------

export { injectProgressBar };

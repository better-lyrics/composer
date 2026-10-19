import { nextFrame } from "@/lib/frame-loop";

// -- Functions -----------------------------------------------------------------

function swallowClick(event: MouseEvent) {
  event.stopPropagation();
  event.preventDefault();
}

// A drag ends with a click on whatever sits under the pointer; without this, that click runs its handler (track clicks clear the selection).
function swallowTrailingClick() {
  window.addEventListener("click", swallowClick, { capture: true, once: true });
  nextFrame(() => window.removeEventListener("click", swallowClick, { capture: true }));
}

// -- Exports -------------------------------------------------------------------

export { swallowTrailingClick };

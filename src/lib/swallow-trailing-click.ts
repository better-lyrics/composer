import { nextFrame } from "@/lib/frame-loop";

// -- Constants -----------------------------------------------------------------

const TRAILING_CLICK_EVENTS = ["click", "dblclick"] as const;

// -- Functions -----------------------------------------------------------------

function swallowClick(event: MouseEvent) {
  event.stopPropagation();
  event.preventDefault();
}

// A drag ends with a click on whatever sits under the pointer, and with a dblclick too when the drag began on a second click; without this, those run their handlers (track clicks clear the selection, track double-clicks add a word).
function swallowTrailingClick() {
  for (const type of TRAILING_CLICK_EVENTS) {
    window.addEventListener(type, swallowClick, { capture: true, once: true });
  }
  nextFrame(() => {
    for (const type of TRAILING_CLICK_EVENTS) {
      window.removeEventListener(type, swallowClick, { capture: true });
    }
  });
}

// -- Exports -------------------------------------------------------------------

export { swallowTrailingClick };

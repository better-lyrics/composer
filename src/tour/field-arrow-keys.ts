// -- Constants ----------------------------------------------------------------

const TOUR_ARROW_KEYS: ReadonlySet<string> = new Set(["ArrowLeft", "ArrowRight"]);
const NON_TEXT_INPUT_TYPES: ReadonlySet<string> = new Set(["button", "checkbox", "radio", "submit", "reset", "range"]);

// -- Helpers ------------------------------------------------------------------

function isTextField(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(target.type);
  return target instanceof HTMLElement && target.isContentEditable;
}

// -- Guard --------------------------------------------------------------------

// driver.js steps the tour on any ArrowLeft or ArrowRight keyup on window, so arrows typed in a field stop at document.
function keepFieldArrowKeysFromTour(): () => void {
  const stopArrowInField = (event: KeyboardEvent) => {
    if (TOUR_ARROW_KEYS.has(event.key) && isTextField(event.target)) event.stopPropagation();
  };
  document.addEventListener("keyup", stopArrowInField);
  return () => document.removeEventListener("keyup", stopArrowInField);
}

// -- Exports ------------------------------------------------------------------

export { keepFieldArrowKeysFromTour };

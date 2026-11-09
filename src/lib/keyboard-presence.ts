import { isTypingTarget } from "@/utils/typing-target";

// -- State --------------------------------------------------------------------

let keyPressedOutsideFields = false;

if (typeof window !== "undefined") {
  // On-screen keyboards only type into fields, so a key pressed anywhere else came from a real keyboard.
  const notice = (event: KeyboardEvent) => {
    if (isTypingTarget(event.target)) return;
    keyPressedOutsideFields = true;
    window.removeEventListener("keydown", notice, true);
  };
  window.addEventListener("keydown", notice, true);
}

// -- API ----------------------------------------------------------------------

// A fine pointer means a desktop or a tablet with a trackpad case; a touch-only tablet counts once a key is pressed.
function hasKeyboard(): boolean {
  return keyPressedOutsideFields || (window.matchMedia?.("(any-pointer: fine)").matches ?? true);
}

// -- Exports ------------------------------------------------------------------

export { hasKeyboard };

import { findMatchingShortcut } from "@/utils/shortcut-matcher";
import { isTypingTarget } from "@/utils/typing-target";

// -- Keys ----------------------------------------------------------------------

// Space presses the focused control here instead of reaching the Timeline shortcuts behind the popover.
function keepSpaceForFocusedControl(e: React.KeyboardEvent): void {
  if (e.key !== " " || isTypingTarget(e.target) || findMatchingShortcut(e.nativeEvent, "global") !== null) return;
  e.stopPropagation();
}

// -- Exports -------------------------------------------------------------------

export { keepSpaceForFocusedControl };

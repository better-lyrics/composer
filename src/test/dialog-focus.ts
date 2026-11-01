import { expect } from "vitest";

// -- Helpers -------------------------------------------------------------------

// A modal's focus manager moves focus in after mount; keys typed before that can land on the close button.
async function untilDialogFocused(): Promise<void> {
  await expect.poll(() => document.querySelector("dialog")?.contains(document.activeElement)).toBe(true);
}

// -- Exports -------------------------------------------------------------------

export { untilDialogFocused };

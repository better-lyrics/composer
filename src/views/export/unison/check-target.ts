import type { CheckField } from "@/domain/unison/submit-checks";
import { revealElement } from "@/ui/reveal-element";

// -- Types ---------------------------------------------------------------------

type CheckTarget = CheckField | "video";

// -- Functions -----------------------------------------------------------------

function revealCheckTarget(target: CheckTarget): void {
  const element = document.querySelector<HTMLElement>(`[data-check-target="${target}"]`);
  const viewport = element?.closest<HTMLElement>("[data-overlayscrollbars-viewport]");
  if (!element || !viewport) return;
  revealElement(viewport, element);
  element.querySelector<HTMLElement>("input, button:not(:disabled)")?.focus({ preventScroll: true });
}

// -- Exports -------------------------------------------------------------------

export { revealCheckTarget };

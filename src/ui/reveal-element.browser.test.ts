import { afterEach, describe, expect, it } from "vitest";
import { revealElement } from "@/ui/reveal-element";

function buildViewport(): { viewport: HTMLDivElement; target: HTMLDivElement } {
  const viewport = document.createElement("div");
  viewport.style.cssText = "height:200px;overflow-y:scroll";
  for (let index = 0; index < 20; index++) {
    const row = document.createElement("div");
    row.style.height = "50px";
    row.textContent = `row ${index}`;
    viewport.append(row);
  }
  document.body.append(viewport);
  return { viewport, target: viewport.children[12] as HTMLDivElement };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("revealElement", () => {
  it("centers the element in the viewport", () => {
    const { viewport, target } = buildViewport();
    revealElement(viewport, target);
    expect(viewport.scrollTop).toBe(12 * 50 - (200 - 50) / 2);
  });

  it("marks the element for the nudge until its animation ends", () => {
    const { viewport, target } = buildViewport();
    revealElement(viewport, target);
    expect(target.hasAttribute("data-nudge")).toBe(true);
    target.dispatchEvent(new AnimationEvent("animationend"));
    expect(target.hasAttribute("data-nudge")).toBe(false);
  });

  describe("edge cases", () => {
    it("clamps at the top for the first element", () => {
      const { viewport } = buildViewport();
      revealElement(viewport, viewport.children[0] as HTMLElement);
      expect(viewport.scrollTop).toBe(0);
    });
  });
});

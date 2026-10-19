import { swallowTrailingClick } from "@/lib/swallow-trailing-click";
import { stepFrames } from "@/test/frame-steps";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// -- Harness ------------------------------------------------------------------

let target: HTMLButtonElement;
let clicks = 0;

beforeEach(() => {
  clicks = 0;
  target = document.createElement("button");
  target.addEventListener("click", () => clicks++);
  document.body.append(target);
});

afterEach(() => {
  target.remove();
});

function click(): MouseEvent {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

// -- Tests --------------------------------------------------------------------

describe("swallowTrailingClick", () => {
  it("keeps the click that ends a drag from reaching its target", () => {
    swallowTrailingClick();

    const event = click();

    expect(clicks).toBe(0);
    expect(event.defaultPrevented).toBe(true);
  });

  describe("invariants", () => {
    it("swallows only one click", () => {
      swallowTrailingClick();

      click();
      click();

      expect(clicks).toBe(1);
    });

    it("lets a later click through when the drag ended without a click", async () => {
      swallowTrailingClick();
      await stepFrames(2);

      click();

      expect(clicks).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("swallows one click when two drags end in the same frame", () => {
      swallowTrailingClick();
      swallowTrailingClick();

      click();
      click();

      expect(clicks).toBe(1);
    });
  });
});

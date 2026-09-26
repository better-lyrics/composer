import { beforeAll, describe, expect, it } from "vitest";
import { FLOATING_LAYER_CSS, installStyleSheet } from "@/test/browser-css";
import { render } from "@/test/render";
import { Modal } from "@/ui/modal";
import { Popover } from "@/ui/popover";

function isTopmostAtCentre(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const topmost = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return topmost !== null && (topmost === element || element.contains(topmost));
}

function floatingLayerOf(element: Element): string {
  let current: Element | null = element;
  while (current && current !== document.body) {
    const { zIndex } = getComputedStyle(current);
    if (zIndex !== "auto") return zIndex;
    current = current.parentElement;
  }
  return "auto";
}

describe("floating layers", () => {
  beforeAll(() => {
    installStyleSheet(FLOATING_LAYER_CSS);
  });

  describe("regressions", () => {
    it("regression: modals share the popover layer, so a confirm opened over a popover is not painted beneath it", async () => {
      const splitter = (confirmOpen: boolean) => (
        <>
          <Popover trigger={<button type="button">Open splitter</button>}>
            <button type="button">Split all</button>
          </Popover>
          <Modal isOpen={confirmOpen} onClose={() => {}} title="Split 2 matching?">
            <button type="button">Split</button>
          </Modal>
        </>
      );
      const screen = await render(splitter(false));
      await screen.getByRole("button", { name: "Open splitter" }).click();
      const popoverButton = screen.getByRole("button", { name: "Split all" });
      await expect.element(popoverButton).toBeInTheDocument();
      const popoverLayer = floatingLayerOf(popoverButton.element());

      await screen.rerender(splitter(true));
      const modalButton = screen.getByRole("button", { name: "Split", exact: true });
      await expect.element(modalButton).toBeInTheDocument();

      expect(popoverLayer).not.toBe("auto");
      expect(floatingLayerOf(modalButton.element())).toBe(popoverLayer);
    });
  });

  describe("invariants", () => {
    it("a popover opened inside a modal renders above the modal", async () => {
      const screen = await render(
        <Modal isOpen onClose={() => {}} title="Settings">
          <Popover trigger={<button type="button">Theme</button>}>
            <button type="button">Harbor</button>
          </Popover>
        </Modal>,
      );
      await screen.getByRole("button", { name: "Theme" }).click();

      const option = screen.getByRole("button", { name: "Harbor" });
      await expect.element(option).toBeInTheDocument();
      expect(isTopmostAtCentre(option.element())).toBe(true);
    });
  });
});

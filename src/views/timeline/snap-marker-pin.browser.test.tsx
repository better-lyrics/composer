import { userEvent } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { SnapMarkerPin } from "@/views/timeline/snap-marker-pin";

// -- Helpers -------------------------------------------------------------------

const defaultProps = {
  index: 0,
  time: 2,
  zoom: 100,
  fadeExtent: 220,
  isDragging: false,
  isNew: false,
  isOnOnset: false,
  onHeadPointerDown: () => {},
  onDelete: () => {},
};

const flash = (container: HTMLElement): HTMLElement | null =>
  container.querySelector<HTMLElement>("[data-snap-marker-flash]");

const head = (container: HTMLElement): HTMLElement | null =>
  container.querySelector<HTMLElement>("[data-snap-marker-head]");

const line = (container: HTMLElement): HTMLElement | null =>
  container.querySelector<HTMLElement>("[data-snap-marker-line]");

const tooltip = (): HTMLElement | null => document.body.querySelector<HTMLElement>("[data-snap-marker-tooltip]");

const deleteButton = (): HTMLButtonElement | null =>
  document.body.querySelector<HTMLButtonElement>("[data-snap-marker-delete]");

const timeLabel = (): HTMLElement | null => document.body.querySelector<HTMLElement>("[data-snap-marker-time-label]");

// -- Tests ---------------------------------------------------------------------

describe("SnapMarkerPin", () => {
  it("positions the pin at time * zoom", async () => {
    const screen = await render(<SnapMarkerPin {...defaultProps} time={2} zoom={100} />);
    const marker = screen.container.querySelector<HTMLElement>("[data-snap-marker='custom']");
    expect(marker?.style.left).toBe("200px");
  });

  it("renders a solid custom line that ignores pointer events", async () => {
    const screen = await render(<SnapMarkerPin {...defaultProps} />);
    const lineEl = line(screen.container);
    expect(lineEl?.classList.contains("snap-custom-line")).toBe(true);
    expect(lineEl?.classList.contains("pointer-events-none")).toBe(true);
  });

  it("renders an interactive draggable head with grab cursor", async () => {
    const screen = await render(<SnapMarkerPin {...defaultProps} />);
    const headEl = head(screen.container);
    expect(headEl?.classList.contains("snap-custom-head")).toBe(true);
    expect(headEl?.classList.contains("pointer-events-auto")).toBe(true);
    expect(headEl?.classList.contains("cursor-grab")).toBe(true);
  });

  it("switches the head to grabbing cursor while dragging", async () => {
    const screen = await render(<SnapMarkerPin {...defaultProps} isDragging />);
    const headEl = head(screen.container);
    expect(headEl?.classList.contains("cursor-grabbing")).toBe(true);
    expect(headEl?.classList.contains("cursor-grab")).toBe(false);
  });

  it("calls onHeadPointerDown with the index when the head is pressed", async () => {
    const onHeadPointerDown = vi.fn();
    const screen = await render(<SnapMarkerPin {...defaultProps} index={3} onHeadPointerDown={onHeadPointerDown} />);
    const headEl = head(screen.container);
    headEl?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
    expect(onHeadPointerDown).toHaveBeenCalledTimes(1);
    expect(onHeadPointerDown.mock.calls[0][0]).toBe(3);
  });

  describe("tooltip", () => {
    it("shows a tooltip with the formatted time on hover", async () => {
      const screen = await render(<SnapMarkerPin {...defaultProps} time={2} />);
      expect(tooltip()).toBeNull();

      const headEl = head(screen.container);
      if (headEl) await userEvent.hover(headEl);

      await expect.poll(() => tooltip()).not.toBeNull();
      await expect.poll(() => timeLabel()?.textContent).toBe("0:02.000");
      expect(timeLabel()?.classList.contains("select-text")).toBe(true);
    });

    it("hides the tooltip while dragging", async () => {
      const screen = await render(<SnapMarkerPin {...defaultProps} isDragging />);
      const headEl = head(screen.container);
      if (headEl) await userEvent.hover(headEl);
      await expect.poll(() => tooltip()).toBeNull();
    });

    it("calls onDelete with the index when the delete button is clicked", async () => {
      const onDelete = vi.fn();
      const screen = await render(<SnapMarkerPin {...defaultProps} index={2} onDelete={onDelete} />);
      const headEl = head(screen.container);
      if (headEl) await userEvent.hover(headEl);

      const button = await vi.waitFor(() => {
        const el = deleteButton();
        if (!el) throw new Error("delete button not yet rendered");
        return el;
      });
      await userEvent.hover(button);
      await userEvent.click(button);
      expect(onDelete).toHaveBeenCalledWith(2);
    });

    it("regression: tooltip stays open while moving from the head onto the delete button", async () => {
      const onDelete = vi.fn();
      const screen = await render(<SnapMarkerPin {...defaultProps} index={4} onDelete={onDelete} />);
      const headEl = head(screen.container);
      if (headEl) await userEvent.hover(headEl);

      const button = await vi.waitFor(() => {
        const el = deleteButton();
        if (!el) throw new Error("delete button not yet rendered");
        return el;
      });

      if (headEl) await userEvent.unhover(headEl);
      await userEvent.hover(button);
      await expect.poll(() => tooltip()).not.toBeNull();

      await userEvent.click(button);
      expect(onDelete).toHaveBeenCalledWith(4);
    });

    it("renders the delete button before the time label in DOM order", async () => {
      const screen = await render(<SnapMarkerPin {...defaultProps} />);
      const headEl = head(screen.container);
      if (headEl) await userEvent.hover(headEl);

      const tooltipEl = await vi.waitFor(() => {
        const el = tooltip();
        if (!el) throw new Error("tooltip not yet rendered");
        return el;
      });

      const interactiveChildren = tooltipEl.querySelectorAll<HTMLElement>(
        "[data-snap-marker-delete], [data-snap-marker-time-label]",
      );
      expect(interactiveChildren.length).toBe(2);
      expect(interactiveChildren[0]?.hasAttribute("data-snap-marker-delete")).toBe(true);
      expect(interactiveChildren[1]?.hasAttribute("data-snap-marker-time-label")).toBe(true);

      const firstButton = tooltipEl.querySelector<HTMLButtonElement>("button");
      expect(firstButton?.hasAttribute("data-snap-marker-delete")).toBe(true);
    });

    it("gives the delete button an enlarged hit area anchored to itself", async () => {
      const screen = await render(<SnapMarkerPin {...defaultProps} />);
      const headEl = head(screen.container);
      if (headEl) await userEvent.hover(headEl);

      const button = await vi.waitFor(() => {
        const el = deleteButton();
        if (!el) throw new Error("delete button not yet rendered");
        return el;
      });

      expect(button.classList.contains("expanded-hit-sm")).toBe(true);
      expect(button.classList.contains("relative")).toBe(true);
      expect(button.classList.contains("size-4")).toBe(true);
      expect(tooltip()?.contains(button)).toBe(true);
      expect(timeLabel()).not.toBeNull();
    });

    it("stays start-aligned with the delete control leading when there is room on the right", async () => {
      const screen = await render(<SnapMarkerPin {...defaultProps} time={2} zoom={100} />);
      const headEl = head(screen.container);
      if (headEl) await userEvent.hover(headEl);

      const tip = await vi.waitFor(() => {
        const el = tooltip();
        if (!el) throw new Error("tooltip not yet rendered");
        return el;
      });
      expect(tip.getAttribute("data-snap-marker-tooltip-align")).toBe("start");
      expect(tip.classList.contains("flex-row-reverse")).toBe(false);
    });

    it("flips to end alignment near the right edge so the delete control stays under the head", async () => {
      const screen = await render(<SnapMarkerPin {...defaultProps} />);
      const headEl = head(screen.container);
      if (!headEl) throw new Error("head not rendered");
      const nearRight = window.innerWidth - 12;
      Object.defineProperty(headEl, "getBoundingClientRect", {
        configurable: true,
        value: () => ({
          left: nearRight,
          right: nearRight + 14,
          top: 24,
          bottom: 38,
          width: 14,
          height: 14,
          x: nearRight,
          y: 24,
          toJSON: () => "",
        }),
      });

      await userEvent.hover(headEl);

      await expect.poll(() => tooltip()?.getAttribute("data-snap-marker-tooltip-align")).toBe("end");
      expect(tooltip()?.classList.contains("flex-row-reverse")).toBe(true);
      const firstButton = tooltip()?.querySelector("button");
      expect(firstButton?.hasAttribute("data-snap-marker-delete")).toBe(true);
    });
  });

  describe("placement animation", () => {
    it("mounts the pin inside the drop-in motion wrapper", async () => {
      const screen = await render(<SnapMarkerPin {...defaultProps} />);
      const wrapper = screen.container.querySelector<HTMLElement>("[data-snap-marker-drop-in]");
      expect(wrapper).not.toBeNull();
      expect(wrapper?.getAttribute("data-snap-marker")).toBe("custom");
    });

    it("flags the drop-in only when the pin is newly placed", async () => {
      const screen = await render(<SnapMarkerPin {...defaultProps} isNew />);
      const wrapper = screen.container.querySelector<HTMLElement>("[data-snap-marker-drop-in]");
      expect(wrapper?.hasAttribute("data-snap-marker-new")).toBe(true);
    });

    it("does not flag the drop-in for an existing pin", async () => {
      const screen = await render(<SnapMarkerPin {...defaultProps} isNew={false} />);
      const wrapper = screen.container.querySelector<HTMLElement>("[data-snap-marker-drop-in]");
      expect(wrapper?.hasAttribute("data-snap-marker-new")).toBe(false);
    });

    it("renders no flash when the pin is not on an onset", async () => {
      const screen = await render(<SnapMarkerPin {...defaultProps} isOnOnset={false} />);
      expect(flash(screen.container)).toBeNull();
    });

    it("renders a flash when the pin lands on an onset", async () => {
      const screen = await render(<SnapMarkerPin {...defaultProps} isOnOnset={false} />);
      expect(flash(screen.container)).toBeNull();

      await screen.rerender(<SnapMarkerPin {...defaultProps} isOnOnset />);

      await expect.poll(() => flash(screen.container)).not.toBeNull();
    });

    it("flashes once when a pin is placed directly on an onset", async () => {
      const screen = await render(<SnapMarkerPin {...defaultProps} isOnOnset />);
      await expect.poll(() => flash(screen.container)).not.toBeNull();
    });

    it("does not re-fire the flash while the pin stays on the same onset", async () => {
      const screen = await render(<SnapMarkerPin {...defaultProps} isOnOnset />);
      const firstFlash = await vi.waitFor(() => {
        const el = flash(screen.container);
        if (!el) throw new Error("flash not yet rendered");
        return el;
      });
      const firstKey = firstFlash.getAttribute("data-flash-key");

      await screen.rerender(<SnapMarkerPin {...defaultProps} isOnOnset time={2.001} />);

      // Same on-onset state across re-render: the flash key must not advance.
      expect(flash(screen.container)?.getAttribute("data-flash-key")).toBe(firstKey);
    });

    it("re-fires the flash when the pin leaves and lands on an onset again", async () => {
      const screen = await render(<SnapMarkerPin {...defaultProps} isOnOnset={false} />);

      await screen.rerender(<SnapMarkerPin {...defaultProps} isOnOnset />);
      const firstFlash = await vi.waitFor(() => {
        const el = flash(screen.container);
        if (!el) throw new Error("flash not yet rendered");
        return el;
      });
      const firstKey = firstFlash.getAttribute("data-flash-key");

      await screen.rerender(<SnapMarkerPin {...defaultProps} isOnOnset={false} />);
      await screen.rerender(<SnapMarkerPin {...defaultProps} isOnOnset />);

      await expect.poll(() => flash(screen.container)).not.toBeNull();
      // The flash element identity changes so the animation replays.
      await expect.poll(() => flash(screen.container)?.getAttribute("data-flash-key")).not.toBe(firstKey);
    });
  });

  describe("reduced motion", () => {
    // The shared render wrapper forces MotionConfig reducedMotion="always",
    // so useReducedMotion() is true here. This asserts the at-rest fallback:
    // the pin mounts in place and the flash element still renders on snap.
    // The animating (non-reduced) path is not reachable through this harness.
    it("renders the pin at rest and stable under reduced motion", async () => {
      const screen = await render(<SnapMarkerPin {...defaultProps} time={2} zoom={100} />);
      const wrapper = screen.container.querySelector<HTMLElement>("[data-snap-marker-drop-in]");
      expect(wrapper).not.toBeNull();
      expect(wrapper?.style.left).toBe("200px");
      await expect.poll(() => wrapper?.style.left).toBe("200px");
    });

    it("still surfaces a flash element on snap under reduced motion", async () => {
      const screen = await render(<SnapMarkerPin {...defaultProps} isOnOnset={false} />);
      await screen.rerender(<SnapMarkerPin {...defaultProps} isOnOnset />);
      await expect.poll(() => flash(screen.container)).not.toBeNull();
    });
  });

  describe("edge cases", () => {
    it("places a pin at the timeline origin", async () => {
      const screen = await render(<SnapMarkerPin {...defaultProps} time={0} />);
      const marker = screen.container.querySelector<HTMLElement>("[data-snap-marker='custom']");
      expect(marker?.style.left).toBe("0px");
    });
  });
});

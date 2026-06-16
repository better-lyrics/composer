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
  onHeadPointerDown: () => {},
  onDelete: () => {},
};

const head = (container: HTMLElement): HTMLElement | null =>
  container.querySelector<HTMLElement>("[data-snap-marker-head]");

const line = (container: HTMLElement): HTMLElement | null =>
  container.querySelector<HTMLElement>("[data-snap-marker-line]");

const tooltip = (container: HTMLElement): HTMLElement | null =>
  container.querySelector<HTMLElement>("[data-snap-marker-tooltip]");

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
      expect(tooltip(screen.container)).toBeNull();

      const headEl = head(screen.container);
      if (headEl) await userEvent.hover(headEl);

      await expect.poll(() => tooltip(screen.container)).not.toBeNull();
      const label = screen.container.querySelector<HTMLElement>("[data-snap-marker-time-label]");
      expect(label?.textContent).toBe("0:02.000");
      expect(label?.classList.contains("select-text")).toBe(true);
    });

    it("hides the tooltip while dragging", async () => {
      const screen = await render(<SnapMarkerPin {...defaultProps} isDragging />);
      const headEl = head(screen.container);
      if (headEl) await userEvent.hover(headEl);
      await expect.poll(() => tooltip(screen.container)).toBeNull();
    });

    it("calls onDelete with the index when the delete button is clicked", async () => {
      const onDelete = vi.fn();
      const screen = await render(<SnapMarkerPin {...defaultProps} index={2} onDelete={onDelete} />);
      const headEl = head(screen.container);
      if (headEl) await userEvent.hover(headEl);

      const deleteButton = await vi.waitFor(() => {
        const button = screen.container.querySelector<HTMLButtonElement>("[data-snap-marker-delete]");
        if (!button) throw new Error("delete button not yet rendered");
        return button;
      });
      await userEvent.click(deleteButton);
      expect(onDelete).toHaveBeenCalledWith(2);
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

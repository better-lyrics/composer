import { render } from "@/test/render";
import { CountdownRing } from "@/ui/countdown-ring";
import { describe, expect, it } from "vitest";

function countdown(start: number) {
  let remaining = start;
  return { read: () => remaining, set: (next: number) => (remaining = next) };
}

const announce = (seconds: number) => `Starting in ${seconds}`;

function arcOffset(container: HTMLElement): number {
  const arc = container.querySelector("[data-countdown-arc]");
  return Number(arc?.getAttribute("stroke-dashoffset"));
}

describe("CountdownRing", () => {
  it("shows whole seconds left, rounded up", async () => {
    const clock = countdown(2.4);
    const screen = await render(<CountdownRing remainingSeconds={clock.read} totalSeconds={3} precision={0} announce={announce} />);
    await expect.element(screen.getByText("3", { exact: true })).toBeInTheDocument();
    clock.set(1.2);
    await expect.element(screen.getByText("2", { exact: true })).toBeInTheDocument();
  });

  it("shows tenths in a fixed format", async () => {
    const clock = countdown(1);
    const screen = await render(<CountdownRing remainingSeconds={clock.read} totalSeconds={1.5} precision={1} announce={announce} />);
    await expect.element(screen.getByText("1.0", { exact: true })).toBeInTheDocument();
    clock.set(0.81);
    await expect.element(screen.getByText("0.9", { exact: true })).toBeInTheDocument();
  });

  it("announces once per whole second for screen readers", async () => {
    const clock = countdown(3);
    const screen = await render(<CountdownRing remainingSeconds={clock.read} totalSeconds={3} precision={1} announce={announce} />);
    const status = screen.getByRole("status");
    await expect.element(status).toHaveTextContent("Starting in 3");
    clock.set(2.5);
    await expect.element(screen.getByText("2.5", { exact: true })).toBeInTheDocument();
    await expect.element(status).toHaveTextContent("Starting in 3");
    clock.set(1.9);
    await expect.element(status).toHaveTextContent("Starting in 2");
  });

  describe("edge cases", () => {
    it("rests at zero once the time has run out", async () => {
      const clock = countdown(-0.5);
      const screen = await render(<CountdownRing remainingSeconds={clock.read} totalSeconds={3} precision={1} announce={announce} />);
      await expect.element(screen.getByText("0.0", { exact: true })).toBeInTheDocument();
    });

    it("shows an empty arc for a zero-length countdown instead of dividing by zero", async () => {
      const screen = await render(<CountdownRing remainingSeconds={() => 0} totalSeconds={0} precision={0} announce={announce} />);
      await expect.poll(() => Number.isFinite(arcOffset(screen.container))).toBe(true);
    });
  });

  describe("regressions", () => {
    it("regression: mounts the live region empty so the first count is announced", async () => {
      const screen = await render(<CountdownRing remainingSeconds={() => 3} totalSeconds={3} precision={0} announce={announce} />);
      const status = screen.container.querySelector('[role="status"]');
      expect(status?.textContent).toBe("");
      await expect.element(screen.getByRole("status")).toHaveTextContent("Starting in 3");
    });
  });

  describe("invariants", () => {
    it("fills the arc as time runs out", async () => {
      const clock = countdown(3);
      const screen = await render(<CountdownRing remainingSeconds={clock.read} totalSeconds={3} precision={0} announce={announce} />);
      await expect.poll(() => arcOffset(screen.container)).toBeGreaterThan(0);
      const full = arcOffset(screen.container);
      clock.set(1.5);
      await expect.poll(() => arcOffset(screen.container)).toBeCloseTo(full / 2, 1);
      clock.set(0);
      await expect.poll(() => arcOffset(screen.container)).toBeCloseTo(0, 5);
    });

    it("hides the visual digits from screen readers so the time is read once", async () => {
      const screen = await render(<CountdownRing remainingSeconds={() => 2} totalSeconds={3} precision={0} announce={announce} />);
      await expect.element(screen.getByText("2", { exact: true })).toHaveAttribute("aria-hidden", "true");
    });
  });
});

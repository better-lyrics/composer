import { useSyncCountInStore } from "@/stores/sync-count-in";
import { render } from "@/test/render";
import { CountInStatus } from "@/views/sync/count-in-status";
import { describe, expect, it } from "vitest";

function startCount(seconds: number, elapsedMs: number): void {
  const startedAt = performance.now() - elapsedMs;
  useSyncCountInStore.setState({ startedAt, endsAt: startedAt + seconds * 1000, seconds });
}

describe("CountInStatus", () => {
  it("reads Starting in with the ring and how to cancel", async () => {
    startCount(3, 0);
    const screen = await render(<CountInStatus />);
    await expect.element(screen.getByText("Starting in", { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByText("Esc", { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByText("to cancel", { exact: true })).toBeInTheDocument();
  });

  it("counts the remaining whole seconds in the ring", async () => {
    startCount(3, 1200);
    const screen = await render(<CountInStatus />);
    await expect.element(screen.getByText("2", { exact: true })).toBeInTheDocument();
  });

  it("announces the count for screen readers", async () => {
    startCount(3, 0);
    const screen = await render(<CountInStatus />);
    await expect.element(screen.getByRole("status")).toHaveTextContent("Starting in 3");
  });

  describe("edge cases", () => {
    it("renders nothing without a running count", async () => {
      const screen = await render(<CountInStatus />);
      expect(screen.container.textContent).toBe("");
    });
  });
});

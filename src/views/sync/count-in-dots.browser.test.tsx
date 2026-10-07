import { useSyncCountInStore } from "@/stores/sync-count-in";
import { render } from "@/test/render";
import { CountInDots } from "@/views/sync/count-in-dots";
import { describe, expect, it } from "vitest";

function startCount(seconds: number, elapsedMs: number): void {
  const startedAt = performance.now() - elapsedMs;
  useSyncCountInStore.setState({ startedAt, endsAt: startedAt + seconds * 1000, seconds });
}

function dots(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("[data-count-in-dot]")];
}

const litCount = (container: HTMLElement) => dots(container).filter((dot) => dot.hasAttribute("data-on")).length;

describe("CountInDots", () => {
  it("shows one dot per second of the count", async () => {
    startCount(3, 0);
    const screen = await render(<CountInDots />);
    expect(dots(screen.container)).toHaveLength(3);
  });

  it("lights the first dot as the count starts", async () => {
    startCount(3, 0);
    const screen = await render(<CountInDots />);
    await expect.poll(() => litCount(screen.container)).toBe(1);
  });

  it("lights one more dot each second", async () => {
    startCount(3, 1100);
    const screen = await render(<CountInDots />);
    await expect.poll(() => litCount(screen.container)).toBe(2);
    startCount(3, 2100);
    await expect.poll(() => litCount(screen.container)).toBe(3);
  });

  describe("edge cases", () => {
    it("caps a long count at six dots", async () => {
      startCount(10, 0);
      const screen = await render(<CountInDots />);
      expect(dots(screen.container)).toHaveLength(6);
    });

    it("never lights more dots than it shows", async () => {
      startCount(10, 9900);
      const screen = await render(<CountInDots />);
      await expect.poll(() => litCount(screen.container)).toBe(6);
    });

    it("renders nothing without a running count", async () => {
      const screen = await render(<CountInDots />);
      expect(dots(screen.container)).toHaveLength(0);
    });
  });

  describe("invariants", () => {
    it("stays out of the accessibility tree, the footer status announces the count", async () => {
      startCount(3, 0);
      const screen = await render(<CountInDots />);
      expect(screen.container.querySelector("[data-count-in-dots]")?.getAttribute("aria-hidden")).toBe("true");
    });
  });
});

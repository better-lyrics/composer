import { holdIdleCallbacks, releaseIdleCallbacks } from "@/test/idle-callbacks";
import { afterEach, describe, expect, it } from "vitest";

// -- Harness ------------------------------------------------------------------

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function busyFor(ms: number): void {
  const until = performance.now() + ms;
  while (performance.now() < until) {
    // Keeps the main thread busy so a real idle period cannot start.
  }
}

afterEach(() => {
  releaseIdleCallbacks();
});

// -- Tests --------------------------------------------------------------------

describe("idle callbacks in browser tests", () => {
  it("runs an idle callback on the next task, even while the main thread is busy", async () => {
    const ran: boolean[] = [];
    window.requestIdleCallback((deadline) => ran.push(deadline.didTimeout));
    busyFor(30);

    await nextTask();

    expect(ran).toEqual([false]);
  });

  it("does not run a cancelled idle callback", async () => {
    let ran = false;
    const handle = window.requestIdleCallback(() => {
      ran = true;
    });
    window.cancelIdleCallback(handle);

    await nextTask();

    expect(ran).toBe(false);
  });

  describe("held callbacks", () => {
    it("waits for a release, then runs them in order", async () => {
      const order: number[] = [];
      holdIdleCallbacks();
      window.requestIdleCallback(() => order.push(1));
      window.requestIdleCallback(() => order.push(2));

      await nextTask();
      expect(order).toEqual([]);

      releaseIdleCallbacks();
      expect(order).toEqual([1, 2]);
    });

    it("drops a held callback that is cancelled before the release", () => {
      const order: number[] = [];
      holdIdleCallbacks();
      const handle = window.requestIdleCallback(() => order.push(1));
      window.cancelIdleCallback(handle);

      releaseIdleCallbacks();

      expect(order).toEqual([]);
    });

    it("runs callbacks requested after a release on the next task again", async () => {
      holdIdleCallbacks();
      releaseIdleCallbacks();
      let ran = false;
      window.requestIdleCallback(() => {
        ran = true;
      });

      await nextTask();

      expect(ran).toBe(true);
    });
  });
});

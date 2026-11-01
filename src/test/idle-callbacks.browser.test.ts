import { describe, expect, it } from "vitest";

// -- Harness ------------------------------------------------------------------

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function busyFor(ms: number): void {
  const until = performance.now() + ms;
  while (performance.now() < until) {
    // Keeps the main thread busy so a real idle period cannot start.
  }
}

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
});

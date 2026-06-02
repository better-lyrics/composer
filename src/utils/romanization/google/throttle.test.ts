import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createThrottle } from "@/utils/romanization/google/throttle";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createThrottle: basic", () => {
  it("preserves task return values", async () => {
    const throttle = createThrottle({ maxPerSecond: 2 });
    const p = throttle(async () => 42);
    await vi.advanceTimersByTimeAsync(0);
    expect(await p).toBe(42);
  });

  it("propagates rejections without breaking the queue", async () => {
    const throttle = createThrottle({ maxPerSecond: 2 });
    const failed = throttle(async () => {
      throw new Error("boom");
    });
    const ok = throttle(async () => "ok");
    await vi.advanceTimersByTimeAsync(0);
    await expect(failed).rejects.toThrow("boom");
    await vi.advanceTimersByTimeAsync(0);
    expect(await ok).toBe("ok");
  });
});

describe("createThrottle: rate limiting", () => {
  it("releases the first N tasks immediately when N === maxPerSecond", async () => {
    const throttle = createThrottle({ maxPerSecond: 2 });
    const order: number[] = [];
    const tasks = [
      throttle(async () => {
        order.push(1);
      }),
      throttle(async () => {
        order.push(2);
      }),
      throttle(async () => {
        order.push(3);
      }),
      throttle(async () => {
        order.push(4);
      }),
    ];
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual([1, 2]);
    await vi.advanceTimersByTimeAsync(500);
    expect(order).toEqual([1, 2, 3]);
    await vi.advanceTimersByTimeAsync(500);
    expect(order).toEqual([1, 2, 3, 4]);
    await Promise.all(tasks);
  });

  it("spaces subsequent tasks by 1000/maxPerSecond ms", async () => {
    const throttle = createThrottle({ maxPerSecond: 4 });
    const order: number[] = [];
    const tasks = [
      throttle(async () => {
        order.push(1);
      }),
      throttle(async () => {
        order.push(2);
      }),
      throttle(async () => {
        order.push(3);
      }),
      throttle(async () => {
        order.push(4);
      }),
      throttle(async () => {
        order.push(5);
      }),
    ];
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual([1, 2, 3, 4]);
    await vi.advanceTimersByTimeAsync(250);
    expect(order).toEqual([1, 2, 3, 4, 5]);
    await Promise.all(tasks);
  });

  it("dispatches in FIFO order even when tasks resolve out of order", async () => {
    const throttle = createThrottle({ maxPerSecond: 2 });
    const order: number[] = [];
    const tasks = [
      throttle(async () => {
        await Promise.resolve();
        await Promise.resolve();
        order.push(1);
      }),
      throttle(async () => {
        order.push(2);
      }),
      throttle(async () => {
        order.push(3);
      }),
    ];
    await vi.advanceTimersByTimeAsync(0);
    expect(order.length).toBe(2);
    expect(order).toContain(2);
    await vi.advanceTimersByTimeAsync(500);
    expect(order.length).toBe(3);
    await Promise.all(tasks);
  });
});

describe("createThrottle: cold start vs warm queue", () => {
  it("does not credit unused capacity after a long idle period (does not burst)", async () => {
    const throttle = createThrottle({ maxPerSecond: 2 });
    const order: number[] = [];

    const a = throttle(async () => {
      order.push(1);
    });
    const b = throttle(async () => {
      order.push(2);
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual([1, 2]);
    await Promise.all([a, b]);

    await vi.advanceTimersByTimeAsync(5000);

    const c = throttle(async () => {
      order.push(3);
    });
    const d = throttle(async () => {
      order.push(4);
    });
    const e = throttle(async () => {
      order.push(5);
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual([1, 2, 3, 4]);
    await vi.advanceTimersByTimeAsync(500);
    expect(order).toEqual([1, 2, 3, 4, 5]);
    await Promise.all([c, d, e]);
  });
});

describe("createThrottle: validation", () => {
  it("throws on maxPerSecond <= 0 (defensive; not a runtime config user can hit)", () => {
    expect(() => createThrottle({ maxPerSecond: 0 })).toThrow();
    expect(() => createThrottle({ maxPerSecond: -1 })).toThrow();
  });

  it("accepts maxPerSecond === 1 (slow but valid)", async () => {
    const throttle = createThrottle({ maxPerSecond: 1 });
    const order: number[] = [];
    const a = throttle(async () => {
      order.push(1);
    });
    const b = throttle(async () => {
      order.push(2);
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual([1]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(order).toEqual([1, 2]);
    await Promise.all([a, b]);
  });
});

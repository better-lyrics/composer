interface ThrottleOpts {
  maxPerSecond: number;
}

function createThrottle(opts: ThrottleOpts): <T>(fn: () => Promise<T>) => Promise<T> {
  if (opts.maxPerSecond <= 0) {
    throw new Error(`createThrottle: maxPerSecond must be > 0, got ${opts.maxPerSecond}`);
  }
  const capacity = opts.maxPerSecond;
  const intervalMs = 1000 / capacity;
  let tokens = capacity;
  let lastRefill = Date.now();

  const refill = (now: number): void => {
    const elapsed = now - lastRefill;
    if (elapsed <= 0) return;
    const earned = elapsed / intervalMs;
    tokens = Math.min(capacity, tokens + earned);
    lastRefill = now;
  };

  let nextDispatchAt = 0;

  return <T>(fn: () => Promise<T>): Promise<T> => {
    const now = Date.now();
    refill(now);
    let delay: number;
    if (tokens >= 1 && nextDispatchAt <= now) {
      tokens -= 1;
      delay = 0;
      nextDispatchAt = now;
    } else {
      const earliestByToken = lastRefill + (1 - tokens) * intervalMs;
      const earliest = Math.max(earliestByToken, nextDispatchAt + intervalMs);
      delay = earliest - now;
      nextDispatchAt = earliest;
      tokens = 0;
      lastRefill = earliest;
    }
    const outer = new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        fn().then(resolve, reject);
      }, delay);
    });
    outer.catch(() => {});
    return outer;
  };
}

export { createThrottle };
export type { ThrottleOpts };

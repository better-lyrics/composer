import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pingGroup } from "@/views/timeline/ping-group";
import { useTimelineStore } from "@/views/timeline/timeline-store";

const pinging = () => useTimelineStore.getState().pingingGroupId;

describe("pingGroup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTimelineStore.setState({ pingingGroupId: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pings the group and clears it after the ping ends", () => {
    pingGroup("g1");
    expect(pinging()).toBe("g1");

    vi.advanceTimersByTime(700);
    expect(pinging()).toBeNull();
  });

  describe("edge cases", () => {
    it("keeps a newer ping of another group when the older one ends", () => {
      pingGroup("g1");
      vi.advanceTimersByTime(400);
      pingGroup("g2");

      vi.advanceTimersByTime(300);
      expect(pinging()).toBe("g2");

      vi.advanceTimersByTime(400);
      expect(pinging()).toBeNull();
    });

    it("stays pinging until the ping ends", () => {
      pingGroup("g1");
      vi.advanceTimersByTime(699);
      expect(pinging()).toBe("g1");
    });
  });
});

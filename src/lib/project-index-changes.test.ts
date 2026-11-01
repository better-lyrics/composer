import { notifyProjectIndexChanged, subscribeProjectIndexChanges } from "@/lib/project-index-changes";
import { describe, expect, it, vi } from "vitest";

describe("project index changes", () => {
  it("calls every listener once per notify until it unsubscribes", () => {
    const calls: string[] = [];
    const stopA = subscribeProjectIndexChanges(() => calls.push("a"));
    const stopB = subscribeProjectIndexChanges(() => calls.push("b"));
    notifyProjectIndexChanged();
    stopA();
    notifyProjectIndexChanged();
    stopB();
    notifyProjectIndexChanged();
    expect(calls).toEqual(["a", "b", "b"]);
  });

  describe("error paths", () => {
    it("keeps notifying the other listeners when one throws, and logs it", () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      const calls: string[] = [];
      const stopThrower = subscribeProjectIndexChanges(() => {
        throw new Error("boom");
      });
      const stopOther = subscribeProjectIndexChanges(() => calls.push("other"));
      notifyProjectIndexChanged();
      expect(calls).toEqual(["other"]);
      expect(errors).toHaveBeenCalledTimes(1);
      stopThrower();
      stopOther();
      errors.mockRestore();
    });
  });
});

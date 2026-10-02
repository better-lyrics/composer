import {
  type StorageSignal,
  isQuotaExceededError,
  notifyStorageSignal,
  reportStorageWriteError,
  subscribeStorageSignals,
} from "@/lib/storage-signals";
import { afterEach, describe, expect, it, vi } from "vitest";

const unsubscribers: (() => void)[] = [];

function record(): StorageSignal[] {
  const seen: StorageSignal[] = [];
  unsubscribers.push(subscribeStorageSignals((signal) => seen.push(signal)));
  return seen;
}

afterEach(() => {
  for (const unsubscribe of unsubscribers.splice(0)) unsubscribe();
  vi.restoreAllMocks();
});

describe("storage signals", () => {
  it("tells every listener what happened, in order", () => {
    const first = record();
    const second = record();
    notifyStorageSignal("media-stored");
    notifyStorageSignal("media-removed");
    expect(first).toEqual(["media-stored", "media-removed"]);
    expect(second).toEqual(["media-stored", "media-removed"]);
  });

  it("stops telling a listener after it unsubscribes", () => {
    const seen: StorageSignal[] = [];
    const unsubscribe = subscribeStorageSignals((signal) => seen.push(signal));
    unsubscribe();
    notifyStorageSignal("media-stored");
    expect(seen).toEqual([]);
  });

  it("reports storage full for quota errors only", () => {
    const seen = record();
    reportStorageWriteError(new DOMException("full", "QuotaExceededError"));
    reportStorageWriteError(new DOMException("gone", "NotFoundError"));
    reportStorageWriteError(new Error("boom"));
    expect(seen).toEqual(["storage-full"]);
  });

  describe("error paths", () => {
    it("a throwing listener does not stop the others", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      unsubscribers.push(
        subscribeStorageSignals(() => {
          throw new Error("listener failed");
        }),
      );
      const seen = record();
      notifyStorageSignal("storage-full");
      expect(seen).toEqual(["storage-full"]);
      expect(error).toHaveBeenCalled();
    });
  });
});

describe("isQuotaExceededError", () => {
  it("recognizes the browser's quota error", () => {
    expect(isQuotaExceededError(new DOMException("full", "QuotaExceededError"))).toBe(true);
  });

  describe("edge cases", () => {
    it("rejects other errors, including plain errors that borrow the name", () => {
      const lookalike = new Error("full");
      lookalike.name = "QuotaExceededError";
      for (const value of [new DOMException("x", "AbortError"), lookalike, "QuotaExceededError", undefined, null]) {
        expect(isQuotaExceededError(value)).toBe(false);
      }
    });
  });
});

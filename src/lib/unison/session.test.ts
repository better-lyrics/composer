import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearUnisonSession,
  readUnisonSession,
  type StoredUnisonSession,
  saveUnisonSession,
  subscribeUnisonSession,
  UNISON_SESSION_STORAGE_KEY,
} from "@/lib/unison/session";

const nowSeconds = () => Math.floor(Date.now() / 1000);

const session = (overrides: Partial<StoredUnisonSession> = {}): StoredUnisonSession => ({
  token: "token-a",
  expiresAt: nowSeconds() + 30 * 24 * 60 * 60,
  keyId: "a".repeat(64),
  displayName: "Quiet Otter",
  avatarUrl: null,
  ...overrides,
});

describe("unison session", () => {
  beforeEach(() => {
    localStorage.clear();
    clearUnisonSession();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("reads back a saved session", () => {
    const saved = session();
    saveUnisonSession(saved);
    expect(readUnisonSession()).toEqual(saved);
  });

  it("reads as signed out after clear", () => {
    saveUnisonSession(session());
    clearUnisonSession();
    expect(readUnisonSession()).toBeNull();
    expect(localStorage.getItem(UNISON_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("notifies subscribers on save and clear", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeUnisonSession(listener);
    saveUnisonSession(session());
    clearUnisonSession();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    saveUnisonSession(session());
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("notifies subscribers when another tab changes the key", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeUnisonSession(listener);
    localStorage.setItem(UNISON_SESSION_STORAGE_KEY, JSON.stringify(session({ token: "other-tab" })));
    window.dispatchEvent(new StorageEvent("storage", { key: UNISON_SESSION_STORAGE_KEY }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(readUnisonSession()?.token).toBe("other-tab");
    unsubscribe();
  });

  describe("edge cases", () => {
    it("ignores storage events for other keys", () => {
      const listener = vi.fn();
      const unsubscribe = subscribeUnisonSession(listener);
      window.dispatchEvent(new StorageEvent("storage", { key: "composer.other.v1" }));
      expect(listener).not.toHaveBeenCalled();
      unsubscribe();
    });

    it("treats a storage clear from another tab as a change", () => {
      const listener = vi.fn();
      const unsubscribe = subscribeUnisonSession(listener);
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
      expect(listener).toHaveBeenCalledTimes(1);
      unsubscribe();
    });

    it("reads an expired session as signed out and removes it", () => {
      localStorage.setItem(UNISON_SESSION_STORAGE_KEY, JSON.stringify(session({ expiresAt: nowSeconds() - 1 })));
      expect(readUnisonSession()).toBeNull();
      expect(localStorage.getItem(UNISON_SESSION_STORAGE_KEY)).toBeNull();
    });

    it("compares expiry in unix seconds, not milliseconds", () => {
      saveUnisonSession(session({ expiresAt: nowSeconds() + 60 }));
      expect(readUnisonSession()).not.toBeNull();
    });

    it("drops a cached session once it expires", () => {
      vi.useFakeTimers();
      try {
        saveUnisonSession(session({ expiresAt: nowSeconds() + 10 }));
        expect(readUnisonSession()).not.toBeNull();
        vi.advanceTimersByTime(11_000);
        expect(readUnisonSession()).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("error paths", () => {
    it("reads malformed JSON as signed out and removes it", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      localStorage.setItem(UNISON_SESSION_STORAGE_KEY, "{not json");
      expect(readUnisonSession()).toBeNull();
      expect(localStorage.getItem(UNISON_SESSION_STORAGE_KEY)).toBeNull();
    });

    it("reads a wrong shape as signed out and removes it", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      localStorage.setItem(UNISON_SESSION_STORAGE_KEY, JSON.stringify({ token: 5, expiresAt: "soon" }));
      expect(readUnisonSession()).toBeNull();
      expect(localStorage.getItem(UNISON_SESSION_STORAGE_KEY)).toBeNull();
    });

    it("logs and keeps going when storage refuses a write", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
      });
      expect(() => saveUnisonSession(session())).not.toThrow();
      expect(warn).toHaveBeenCalled();
      expect(JSON.stringify(warn.mock.calls)).not.toContain("token-a");
    });
  });

  describe("invariants", () => {
    it("returns the same reference between reads with no change", () => {
      saveUnisonSession(session());
      const first = readUnisonSession();
      expect(readUnisonSession()).toBe(first);
    });

    it("returns a new reference after the stored value changes", () => {
      saveUnisonSession(session());
      const first = readUnisonSession();
      saveUnisonSession(session({ displayName: "Loud Otter" }));
      expect(readUnisonSession()).not.toBe(first);
      expect(readUnisonSession()?.displayName).toBe("Loud Otter");
    });
  });
});

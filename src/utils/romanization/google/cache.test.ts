import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GoogleCache } from "@/utils/romanization/google/cache";

let cache: GoogleCache;

beforeEach(async () => {
  cache = new GoogleCache({ maxEntries: 5, dbName: `test-${Date.now()}-${Math.random()}` });
  await cache.open();
  await cache.clearForTests();
});

afterEach(async () => {
  await cache.close();
});

describe("GoogleCache: reads and writes", () => {
  it("returns undefined for an unset key", async () => {
    expect(await cache.get("ja", "夜")).toBeUndefined();
  });

  it("returns the cached value after set", async () => {
    await cache.set("ja", "夜", "yoru");
    expect(await cache.get("ja", "夜")).toBe("yoru");
  });

  it("scopes keys by source language", async () => {
    await cache.set("ja", "夜", "yoru");
    expect(await cache.get("ko", "夜")).toBeUndefined();
    expect(await cache.get("ja", "夜")).toBe("yoru");
  });

  it("overwrites the value on repeat set", async () => {
    await cache.set("ja", "夜", "v1");
    await cache.set("ja", "夜", "v2");
    expect(await cache.get("ja", "夜")).toBe("v2");
  });

  it("setMany writes multiple entries in one transaction", async () => {
    await cache.setMany("ko", [
      ["사", "sa"],
      ["랑", "lang"],
    ]);
    expect(await cache.get("ko", "사")).toBe("sa");
    expect(await cache.get("ko", "랑")).toBe("lang");
  });

  it("setMany on empty pairs is a no-op (does not throw)", async () => {
    await expect(cache.setMany("ko", [])).resolves.toBeUndefined();
  });
});

describe("GoogleCache: LRU eviction", () => {
  it("evicts the oldest entry when over capacity", async () => {
    await cache.set("ja", "a", "1");
    await cache.set("ja", "b", "2");
    await cache.set("ja", "c", "3");
    await cache.set("ja", "d", "4");
    await cache.set("ja", "e", "5");
    await cache.set("ja", "f", "6");
    expect(await cache.get("ja", "a")).toBeUndefined();
    expect(await cache.get("ja", "f")).toBe("6");
  });

  it("get() bumps an entry's LRU position so it survives a later eviction", async () => {
    await cache.set("ja", "a", "1");
    await cache.set("ja", "b", "2");
    await cache.set("ja", "c", "3");
    await cache.set("ja", "d", "4");
    await cache.set("ja", "e", "5");
    await cache.get("ja", "a");
    await cache.set("ja", "f", "6");
    expect(await cache.get("ja", "a")).toBe("1");
    expect(await cache.get("ja", "b")).toBeUndefined();
    expect(await cache.get("ja", "f")).toBe("6");
  });

  it("evicts multiple entries at once when a batch write goes well over capacity", async () => {
    for (let i = 0; i < 5; i++) await cache.set("ja", `k${i}`, `v${i}`);
    await cache.setMany("ja", [
      ["new1", "n1"],
      ["new2", "n2"],
      ["new3", "n3"],
    ]);
    expect(await cache.get("ja", "k0")).toBeUndefined();
    expect(await cache.get("ja", "k1")).toBeUndefined();
    expect(await cache.get("ja", "k2")).toBeUndefined();
    expect(await cache.get("ja", "new3")).toBe("n3");
  });
});

describe("GoogleCache: persistence and lifecycle", () => {
  it("persists entries across close + reopen", async () => {
    const dbName = `persist-test-${Date.now()}-${Math.random()}`;
    const c1 = new GoogleCache({ maxEntries: 5, dbName });
    await c1.open();
    await c1.set("ja", "夜", "yoru");
    await c1.close();
    const c2 = new GoogleCache({ maxEntries: 5, dbName });
    await c2.open();
    expect(await c2.get("ja", "夜")).toBe("yoru");
    await c2.close();
  });

  it("open is idempotent (calling twice does not crash)", async () => {
    await cache.open();
    await cache.open();
    await cache.set("ja", "夜", "yoru");
    expect(await cache.get("ja", "夜")).toBe("yoru");
  });

  it("operations after close throw or reject (do not silently no-op)", async () => {
    await cache.close();
    await expect(cache.get("ja", "夜")).rejects.toThrow();
  });

  it("clearForTests removes all entries", async () => {
    await cache.set("ja", "夜", "yoru");
    await cache.set("ko", "안녕", "annyeong");
    await cache.clearForTests();
    expect(await cache.get("ja", "夜")).toBeUndefined();
    expect(await cache.get("ko", "안녕")).toBeUndefined();
  });
});

describe("GoogleCache: edge cases", () => {
  it("handles empty string keys (does not collide with other entries)", async () => {
    await cache.set("ja", "", "empty");
    await cache.set("ja", "夜", "yoru");
    expect(await cache.get("ja", "")).toBe("empty");
    expect(await cache.get("ja", "夜")).toBe("yoru");
  });

  it("handles keys containing the '::' separator without collision", async () => {
    await cache.set("ja", "a::b", "x");
    await cache.set("ja::extra", "b", "y");
    expect(await cache.get("ja", "a::b")).toBe("x");
    expect(await cache.get("ja::extra", "b")).toBe("y");
  });

  it("handles unicode source text correctly (no encoding loss)", async () => {
    await cache.set("ar", "السلام", "as-salaam");
    expect(await cache.get("ar", "السلام")).toBe("as-salaam");
  });

  it("does not crash on maxEntries: 1 (degenerate case)", async () => {
    const tiny = new GoogleCache({ maxEntries: 1, dbName: `tiny-${Date.now()}` });
    await tiny.open();
    await tiny.set("ja", "a", "1");
    await tiny.set("ja", "b", "2");
    expect(await tiny.get("ja", "a")).toBeUndefined();
    expect(await tiny.get("ja", "b")).toBe("2");
    await tiny.close();
  });
});

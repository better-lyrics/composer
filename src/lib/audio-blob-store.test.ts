import { beforeEach, describe, expect, it } from "vitest";
import { MemoryAudioBlobStore } from "@/lib/audio-blob-store";

describe("MemoryAudioBlobStore", () => {
  let store: MemoryAudioBlobStore;
  beforeEach(() => {
    store = new MemoryAudioBlobStore();
  });

  describe("happy paths", () => {
    it("writes then reads back bytes by project id", async () => {
      const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
      await store.put("p1", bytes);
      const out = await store.get("p1");
      expect(out).toBeInstanceOf(ArrayBuffer);
      expect(new Uint8Array(out!)).toEqual(new Uint8Array(bytes));
    });

    it("returns undefined for unknown project id", async () => {
      expect(await store.get("missing")).toBeUndefined();
    });

    it("deletes by project id", async () => {
      await store.put("p1", new ArrayBuffer(8));
      await store.delete("p1");
      expect(await store.get("p1")).toBeUndefined();
    });

    it("has() returns true only when bytes exist", async () => {
      expect(await store.has("p1")).toBe(false);
      await store.put("p1", new ArrayBuffer(4));
      expect(await store.has("p1")).toBe(true);
    });

    it("lists all stored project ids", async () => {
      await store.put("a", new ArrayBuffer(1));
      await store.put("b", new ArrayBuffer(1));
      const ids = await store.listIds();
      expect(ids.sort()).toEqual(["a", "b"]);
    });
  });

  describe("edge cases", () => {
    it("overwrites existing bytes on put", async () => {
      await store.put("p1", new Uint8Array([1]).buffer);
      await store.put("p1", new Uint8Array([2, 3]).buffer);
      const out = await store.get("p1");
      expect(new Uint8Array(out!)).toEqual(new Uint8Array([2, 3]));
    });

    it("delete on missing id is a no-op", async () => {
      await expect(store.delete("missing")).resolves.toBeUndefined();
    });

    it("listIds() on empty store returns []", async () => {
      expect(await store.listIds()).toEqual([]);
    });

    it("put after delete re-adds the entry", async () => {
      await store.put("p1", new Uint8Array([1]).buffer);
      await store.delete("p1");
      await store.put("p1", new Uint8Array([9]).buffer);
      const out = await store.get("p1");
      expect(new Uint8Array(out!)).toEqual(new Uint8Array([9]));
    });
  });

  describe("invariants", () => {
    it("put/get is byte-identical (no truncation)", async () => {
      const big = new Uint8Array(1024 * 64).map((_, i) => i % 256).buffer;
      await store.put("p1", big);
      const out = await store.get("p1");
      expect(out!.byteLength).toBe(big.byteLength);
      expect(new Uint8Array(out!)).toEqual(new Uint8Array(big));
    });

    it("overwriting the same id does not duplicate it in listIds()", async () => {
      await store.put("p1", new ArrayBuffer(1));
      await store.put("p1", new ArrayBuffer(1));
      expect(await store.listIds()).toEqual(["p1"]);
    });
  });
});

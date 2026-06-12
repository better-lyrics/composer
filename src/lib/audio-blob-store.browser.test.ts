import { beforeEach, describe, expect, it } from "vitest";
import { OpfsAudioBlobStore } from "@/lib/audio-blob-store";

describe("OpfsAudioBlobStore", () => {
  let store: OpfsAudioBlobStore;

  beforeEach(async () => {
    const root = await navigator.storage.getDirectory();
    try {
      await root.removeEntry("audio", { recursive: true });
    } catch (err) {
      if (!(err instanceof DOMException) || err.name !== "NotFoundError") throw err;
    }
    store = new OpfsAudioBlobStore();
  });

  describe("happy paths", () => {
    it("writes then reads back bytes by project id", async () => {
      const bytes = new Uint8Array([10, 20, 30, 40]).buffer;
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

    it("lists all stored project ids stripped of .bin suffix", async () => {
      await store.put("a", new ArrayBuffer(1));
      await store.put("b", new ArrayBuffer(1));
      const ids = await store.listIds();
      expect(ids.toSorted()).toEqual(["a", "b"]);
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

    it("listIds() ignores non-.bin entries in the audio dir", async () => {
      const root = await navigator.storage.getDirectory();
      const audioDir = await root.getDirectoryHandle("audio", { create: true });
      const fh = await audioDir.getFileHandle("README.txt", { create: true });
      const w = await fh.createWritable();
      await w.write("ignore me");
      await w.close();
      await store.put("real", new ArrayBuffer(2));
      expect(await store.listIds()).toEqual(["real"]);
    });

    it("put after delete re-adds the entry (lifecycle round-trip)", async () => {
      await store.put("p1", new Uint8Array([1]).buffer);
      await store.delete("p1");
      await store.put("p1", new Uint8Array([9]).buffer);
      const out = await store.get("p1");
      expect(new Uint8Array(out!)).toEqual(new Uint8Array([9]));
    });
  });

  describe("invariants", () => {
    it("put/get is byte-identical (no truncation) for 64 KiB", async () => {
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

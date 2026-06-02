import { afterEach, describe, expect, it } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import {
  clearGeneratorRegistry,
  getGeneratorFactory,
  registerGeneratorFactory,
  restoreGeneratorRegistry,
  snapshotGeneratorRegistry,
} from "@/domain/romanization/registry";
import type { RomanizationGenerator } from "@/domain/romanization/registry";

// -- Helpers ------------------------------------------------------------------

function makeFactory(scheme: string): () => Promise<RomanizationGenerator> {
  return async () => ({
    scheme,
    generateLine: async (line: LyricLine) => ({ text: line.text.toUpperCase() }),
  });
}

// -- Tests --------------------------------------------------------------------

describe("generator registry", () => {
  let snapshot: ReturnType<typeof snapshotGeneratorRegistry>;

  afterEach(() => {
    restoreGeneratorRegistry(snapshot);
  });

  describe("getGeneratorFactory", () => {
    it("returns undefined for an unknown scheme", () => {
      snapshot = snapshotGeneratorRegistry();
      clearGeneratorRegistry();
      expect(getGeneratorFactory("xx-Latn-foo")).toBeUndefined();
    });

    it("returns the registered factory", () => {
      snapshot = snapshotGeneratorRegistry();
      clearGeneratorRegistry();
      const factory = makeFactory("test-scheme");
      registerGeneratorFactory("test-scheme", factory);
      expect(getGeneratorFactory("test-scheme")).toBe(factory);
    });
  });

  describe("registerGeneratorFactory", () => {
    it("registers a factory under its scheme id", async () => {
      snapshot = snapshotGeneratorRegistry();
      clearGeneratorRegistry();
      const factory = makeFactory("scheme-a");
      registerGeneratorFactory("scheme-a", factory);
      const resolved = getGeneratorFactory("scheme-a");
      expect(resolved).toBeDefined();
      const generator = await resolved?.();
      expect(generator?.scheme).toBe("scheme-a");
      const line: LyricLine = { id: "L1", text: "hi", agentId: "v1" };
      const result = await generator?.generateLine(line);
      expect(result?.text).toBe("HI");
    });

    it("overwrites a previously registered factory for the same scheme", () => {
      snapshot = snapshotGeneratorRegistry();
      clearGeneratorRegistry();
      const factoryA = makeFactory("scheme-a");
      const factoryB = makeFactory("scheme-a");
      registerGeneratorFactory("scheme-a", factoryA);
      registerGeneratorFactory("scheme-a", factoryB);
      expect(getGeneratorFactory("scheme-a")).toBe(factoryB);
    });

    it("keeps schemes independent", () => {
      snapshot = snapshotGeneratorRegistry();
      clearGeneratorRegistry();
      const factoryA = makeFactory("scheme-a");
      const factoryB = makeFactory("scheme-b");
      registerGeneratorFactory("scheme-a", factoryA);
      registerGeneratorFactory("scheme-b", factoryB);
      expect(getGeneratorFactory("scheme-a")).toBe(factoryA);
      expect(getGeneratorFactory("scheme-b")).toBe(factoryB);
    });
  });

  describe("snapshotGeneratorRegistry / restoreGeneratorRegistry", () => {
    it("round-trips the registry contents", () => {
      snapshot = snapshotGeneratorRegistry();
      clearGeneratorRegistry();
      const factory = makeFactory("scheme-a");
      registerGeneratorFactory("scheme-a", factory);
      const taken = snapshotGeneratorRegistry();
      clearGeneratorRegistry();
      expect(getGeneratorFactory("scheme-a")).toBeUndefined();
      restoreGeneratorRegistry(taken);
      expect(getGeneratorFactory("scheme-a")).toBe(factory);
    });

    it("restore overwrites any current registrations", () => {
      snapshot = snapshotGeneratorRegistry();
      clearGeneratorRegistry();
      const factoryA = makeFactory("scheme-a");
      registerGeneratorFactory("scheme-a", factoryA);
      const taken = snapshotGeneratorRegistry();
      clearGeneratorRegistry();
      const factoryB = makeFactory("scheme-b");
      registerGeneratorFactory("scheme-b", factoryB);
      restoreGeneratorRegistry(taken);
      expect(getGeneratorFactory("scheme-a")).toBe(factoryA);
      expect(getGeneratorFactory("scheme-b")).toBeUndefined();
    });
  });

  describe("clearGeneratorRegistry", () => {
    it("removes all entries", () => {
      snapshot = snapshotGeneratorRegistry();
      registerGeneratorFactory("scheme-a", makeFactory("scheme-a"));
      registerGeneratorFactory("scheme-b", makeFactory("scheme-b"));
      clearGeneratorRegistry();
      expect(getGeneratorFactory("scheme-a")).toBeUndefined();
      expect(getGeneratorFactory("scheme-b")).toBeUndefined();
    });
  });
});

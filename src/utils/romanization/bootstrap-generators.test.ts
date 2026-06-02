import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getGeneratorFactory,
  restoreGeneratorRegistry,
  snapshotGeneratorRegistry,
} from "@/domain/romanization/registry";
import { SCHEMES } from "@/domain/romanization/schemes";
import { registerAllRomanizationGenerators } from "@/utils/romanization/bootstrap-generators";

// -- Tests --------------------------------------------------------------------

describe("registerAllRomanizationGenerators", () => {
  let snapshot: ReturnType<typeof snapshotGeneratorRegistry>;

  beforeEach(() => {
    snapshot = snapshotGeneratorRegistry();
  });

  afterEach(() => {
    restoreGeneratorRegistry(snapshot);
  });

  it("registers a factory for every local scheme in SCHEMES", () => {
    registerAllRomanizationGenerators();
    const localSchemes = SCHEMES.filter((s) => s.script === "japanese" || s.script === "chinese");
    for (const scheme of localSchemes) {
      const factory = getGeneratorFactory(scheme.id);
      expect(factory, `missing factory for ${scheme.id}`).toBeDefined();
      expect(typeof factory).toBe("function");
    }
  });

  it("chinese factories resolve to a generator carrying the requested scheme id", async () => {
    registerAllRomanizationGenerators();
    const chineseSchemes = SCHEMES.filter((s) => s.script === "chinese").map((s) => s.id);
    for (const scheme of chineseSchemes) {
      const factory = getGeneratorFactory(scheme);
      expect(factory).toBeDefined();
      if (!factory) continue;
      const generator = await factory();
      expect(generator.scheme).toBe(scheme);
    }
  });

  it("is idempotent: calling it twice still leaves one factory per local scheme", () => {
    registerAllRomanizationGenerators();
    registerAllRomanizationGenerators();
    const localSchemes = SCHEMES.filter((s) => s.script === "japanese" || s.script === "chinese");
    for (const scheme of localSchemes) {
      expect(getGeneratorFactory(scheme.id)).toBeDefined();
    }
  });
});

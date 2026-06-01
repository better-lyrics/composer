import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getGeneratorFactory,
  restoreGeneratorRegistry,
  snapshotGeneratorRegistry,
} from "@/domain/romanization/registry";
import { SCHEMES } from "@/domain/romanization/schemes";
import { registerAllRomanizationGenerators } from "@/utils/romanization/bootstrap-generators";

// -- Tests --------------------------------------------------------------------

describe("registerAllRomanizationGenerators (japanese)", () => {
  let snapshot: ReturnType<typeof snapshotGeneratorRegistry>;

  beforeEach(() => {
    snapshot = snapshotGeneratorRegistry();
  });

  afterEach(() => {
    restoreGeneratorRegistry(snapshot);
  });

  it("japanese factories resolve to a generator carrying the requested scheme id", async () => {
    registerAllRomanizationGenerators();
    const japaneseSchemes = SCHEMES.filter((s) => s.script === "japanese").map((s) => s.id);
    for (const scheme of japaneseSchemes) {
      const factory = getGeneratorFactory(scheme);
      expect(factory).toBeDefined();
      if (!factory) continue;
      const generator = await factory();
      expect(generator.scheme).toBe(scheme);
    }
  }, 60000);
});

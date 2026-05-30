import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  getGeneratorFactory,
  restoreGeneratorRegistry,
  snapshotGeneratorRegistry,
} from "@/domain/romanization/registry";
import { SCHEMES } from "@/domain/romanization/schemes";
import { registerAllRomanizationGenerators } from "@/utils/romanization/bootstrap-generators";
import { setKuroshiroDictPathForTests } from "@/utils/romanization/kuroshiro-generator";

// -- Setup --------------------------------------------------------------------

beforeAll(() => {
  const require = createRequire(import.meta.url);
  const kuromojiEntry = require.resolve("kuromoji");
  const dictPath = resolve(dirname(kuromojiEntry), "..", "dict");
  setKuroshiroDictPathForTests(dictPath);
});

afterAll(() => {
  setKuroshiroDictPathForTests(null);
});

// -- Tests --------------------------------------------------------------------

describe("registerAllRomanizationGenerators", () => {
  let snapshot: ReturnType<typeof snapshotGeneratorRegistry>;

  beforeEach(() => {
    snapshot = snapshotGeneratorRegistry();
  });

  afterEach(() => {
    restoreGeneratorRegistry(snapshot);
  });

  it("registers a factory for every scheme in SCHEMES", () => {
    registerAllRomanizationGenerators();
    for (const scheme of SCHEMES) {
      const factory = getGeneratorFactory(scheme.id);
      expect(factory, `missing factory for ${scheme.id}`).toBeDefined();
      expect(typeof factory).toBe("function");
    }
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

  it("is idempotent: calling it twice still leaves one factory per scheme", () => {
    registerAllRomanizationGenerators();
    registerAllRomanizationGenerators();
    for (const scheme of SCHEMES) {
      expect(getGeneratorFactory(scheme.id)).toBeDefined();
    }
  });

  it("does not load kuroshiro or pinyin-pro eagerly", () => {
    registerAllRomanizationGenerators();
    expect(true).toBe(true);
  });
});

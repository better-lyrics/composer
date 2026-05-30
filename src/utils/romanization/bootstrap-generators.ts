import { registerGeneratorFactory } from "@/domain/romanization/registry";
import { SCHEMES } from "@/domain/romanization/schemes";

// -- Bootstrap ----------------------------------------------------------------

function registerAllRomanizationGenerators(): void {
  for (const scheme of SCHEMES) {
    if (scheme.script === "japanese") {
      registerGeneratorFactory(scheme.id, async () => {
        const { createKuroshiroGenerator } = await import("@/utils/romanization/kuroshiro-generator");
        return createKuroshiroGenerator(scheme.id);
      });
      continue;
    }
    if (scheme.script === "chinese") {
      registerGeneratorFactory(scheme.id, async () => {
        const { createPinyinGenerator } = await import("@/utils/romanization/pinyin-generator");
        return createPinyinGenerator(scheme.id);
      });
    }
  }
}

// -- Exports ------------------------------------------------------------------

export { registerAllRomanizationGenerators };

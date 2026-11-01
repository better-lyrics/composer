import type { SettingEntry } from "@/stores/settings-catalog";

// -- Catalog ------------------------------------------------------------------

const MODELS_CATALOG_ENTRIES = {
  vocalModelVariant: {
    section: "models",
    group: "Vocal separation",
    label: "Vocal model",
    description: "fp16 is half the size but needs WebGPU shader-f16.",
    keywords: ["fp16", "fp32", "stems", "separation", "precision"],
    settingKey: "vocalModelVariant",
  },
  autoSeparateOnImport: {
    section: "models",
    group: "Vocal separation",
    label: "Separate vocals on import",
    description: "Runs the vocal model each time you load a new song.",
    keywords: ["stems", "isolate", "auto-separate", "automatically"],
    settingKey: "autoSeparateOnImport",
  },
  alignmentModelId: {
    section: "models",
    group: "Auto-align",
    label: "Alignment model",
    description: "The model that times each word. Recommended follows the newest tested model.",
    keywords: ["hubertfa", "auto-align", "forced alignment", "checkpoint", "manifest"],
    settingKey: "alignmentModelId",
  },
  keepAlignmentModelLoaded: {
    section: "models",
    group: "Auto-align",
    label: "Keep alignment model loaded",
    description:
      "Aligning one line starts at once, and splitting a word times its syllables from the audio. Uses about 400 MB of memory.",
    keywords: ["hubertfa", "auto-align", "memory", "gpu", "unload"],
    settingKey: "keepAlignmentModelLoaded",
  },
} as const satisfies Record<string, SettingEntry>;

// -- Exports ------------------------------------------------------------------

export { MODELS_CATALOG_ENTRIES };

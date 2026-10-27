import {
  BUILTIN_ALIGNMENT_MODEL,
  RECOMMENDED_ALIGNMENT_MODEL,
  parseAlignmentManifest,
  pickAlignmentModel,
} from "@/audio/alignment/hubertfa/model-manifest";
import { describe, expect, it } from "vitest";

const MANIFEST_URL = "https://models.example.com/hubertfa/models.json";
const BASE_URL = "https://models.example.com";

describe("parseAlignmentManifest", () => {
  it("resolves entries against the manifest URL and keeps the built-in model first", () => {
    const models = parseAlignmentManifest(
      {
        models: [
          {
            id: "ft-1",
            label: "Posttrain 1",
            model: "ft1.onnx",
            sizeMb: 400,
            languages: ["EN-us", "en", 3],
            recommended: true,
          },
          { id: "ft-2", model: "https://cdn.example.com/ft2.onnx", dictionary: "../dict.txt" },
          { id: "broken", label: "No model file" },
          { id: BUILTIN_ALIGNMENT_MODEL.id, label: "Duplicate of the built-in", model: "dup.onnx" },
          // The setting's own value for "follow the recommendation"; a checkpoint can't take it.
          { id: RECOMMENDED_ALIGNMENT_MODEL, label: "Clashes with the setting", model: "clash.onnx" },
        ],
      },
      MANIFEST_URL,
      BASE_URL,
    );

    expect(models).toEqual([
      expect.objectContaining({
        id: BUILTIN_ALIGNMENT_MODEL.id,
        modelUrl: `${BASE_URL}/hubertfa_v007_fp32_webgpu.onnx`,
      }),
      {
        id: "ft-1",
        label: "Posttrain 1",
        modelUrl: "https://models.example.com/hubertfa/ft1.onnx",
        dictionaryUrl: `${BASE_URL}/hubertfa_v007_cmudict.txt`,
        approxBytes: 400 * 1024 * 1024,
        languages: ["en"],
        recommended: true,
      },
      expect.objectContaining({
        id: "ft-2",
        label: "ft-2",
        modelUrl: "https://cdn.example.com/ft2.onnx",
        dictionaryUrl: "https://models.example.com/dict.txt",
        languages: BUILTIN_ALIGNMENT_MODEL.languages,
        recommended: false,
      }),
    ]);
  });

  it("regression: keeps only language codes the browser can name", () => {
    const [, model] = parseAlignmentManifest(
      { models: [{ id: "ft", model: "ft.onnx", languages: ["en_US", "not a code!", "x"] }] },
      MANIFEST_URL,
      BASE_URL,
    );
    expect(model.languages).toEqual(["en"]);
  });

  it("keeps only languages auto-align can align, and none when a model lists only others", () => {
    const [, mixed, foreign] = parseAlignmentManifest(
      {
        models: [
          { id: "mixed", model: "mixed.onnx", languages: ["ko", "ja", "cmn"] },
          { id: "foreign", model: "foreign.onnx", languages: ["ko"] },
        ],
      },
      MANIFEST_URL,
      BASE_URL,
    );
    expect(mixed.languages).toEqual(["ja", "zh"]);
    expect(foreign.languages).toEqual([]);
  });

  it("regression: an empty or unreadable language list keeps the base model's languages", () => {
    const [, empty, unreadable] = parseAlignmentManifest(
      {
        models: [
          { id: "empty", model: "empty.onnx", languages: [] },
          { id: "unreadable", model: "unreadable.onnx", languages: ["not a code!", 3] },
        ],
      },
      MANIFEST_URL,
      BASE_URL,
    );
    expect(empty.languages).toEqual(BUILTIN_ALIGNMENT_MODEL.languages);
    expect(unreadable.languages).toEqual(BUILTIN_ALIGNMENT_MODEL.languages);
  });

  it("falls back to the built-in model alone for a malformed manifest", () => {
    expect(parseAlignmentManifest("not json", MANIFEST_URL, BASE_URL).map((m) => m.id)).toEqual([
      BUILTIN_ALIGNMENT_MODEL.id,
    ]);
  });
});

describe("pickAlignmentModel", () => {
  const models = parseAlignmentManifest(
    {
      models: [
        { id: "ft-1", model: "ft1.onnx" },
        { id: "ft-2", model: "ft2.onnx", recommended: true },
      ],
    },
    MANIFEST_URL,
    BASE_URL,
  );

  it("follows the manifest's recommended model by default, and keeps a model picked by hand", () => {
    expect(pickAlignmentModel(models, RECOMMENDED_ALIGNMENT_MODEL)?.id).toBe("ft-2");
    expect(pickAlignmentModel(models, "ft-1")?.id).toBe("ft-1");
  });

  it("falls back to the built-in model with no recommendation, or for a model that left the manifest", () => {
    expect(pickAlignmentModel(models.slice(0, 2), RECOMMENDED_ALIGNMENT_MODEL)?.id).toBe(BUILTIN_ALIGNMENT_MODEL.id);
    expect(pickAlignmentModel(models, "gone")?.id).toBe(BUILTIN_ALIGNMENT_MODEL.id);
  });
});

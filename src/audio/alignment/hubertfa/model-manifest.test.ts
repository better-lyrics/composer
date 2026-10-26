import { BUILTIN_ALIGNMENT_MODEL, parseAlignmentManifest } from "@/audio/alignment/hubertfa/model-manifest";
import { describe, expect, it } from "vitest";

const MANIFEST_URL = "https://models.example.com/hubertfa/models.json";
const BASE_URL = "https://models.example.com";

describe("parseAlignmentManifest", () => {
  it("resolves entries against the manifest URL and keeps the built-in model first", () => {
    const models = parseAlignmentManifest(
      {
        models: [
          { id: "ft-1", label: "Posttrain 1", model: "ft1.onnx", sizeMb: 400 },
          { id: "ft-2", model: "https://cdn.example.com/ft2.onnx", dictionary: "../dict.txt" },
          { id: "broken", label: "No model file" },
          { id: BUILTIN_ALIGNMENT_MODEL.id, label: "Duplicate of the built-in", model: "dup.onnx" },
        ],
      },
      MANIFEST_URL,
      BASE_URL,
    );

    expect(models).toEqual([
      expect.objectContaining({ id: BUILTIN_ALIGNMENT_MODEL.id, modelUrl: `${BASE_URL}/hubertfa_v007_fp32_webgpu.onnx` }),
      {
        id: "ft-1",
        label: "Posttrain 1",
        modelUrl: "https://models.example.com/hubertfa/ft1.onnx",
        dictionaryUrl: `${BASE_URL}/hubertfa_v007_cmudict.txt`,
        approxBytes: 400 * 1024 * 1024,
      },
      expect.objectContaining({
        id: "ft-2",
        label: "ft-2",
        modelUrl: "https://cdn.example.com/ft2.onnx",
        dictionaryUrl: "https://models.example.com/dict.txt",
      }),
    ]);
  });

  it("falls back to the built-in model alone for a malformed manifest", () => {
    expect(parseAlignmentManifest("not json", MANIFEST_URL, BASE_URL).map((m) => m.id)).toEqual([
      BUILTIN_ALIGNMENT_MODEL.id,
    ]);
  });
});

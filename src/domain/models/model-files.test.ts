import { groupModelFiles, modelFilesBytes } from "@/domain/models/model-files";
import { describe, expect, it } from "vitest";

const VOCAL = ["https://m.example/htdemucs_fp16.onnx", "https://m.example/htdemucs_fp32.onnx"];
const BEAT = "https://m.example/beat_this_small0_v1.onnx";
const known = { vocalUrls: VOCAL, beatUrl: BEAT };

describe("groupModelFiles", () => {
  it("sorts each cached file under the feature that downloaded it", () => {
    const files = [
      { url: VOCAL[1], bytes: 171 },
      { url: BEAT, bytes: 9 },
      { url: "https://m.example/hubertfa/model.onnx", bytes: 396 },
      { url: "https://m.example/kuromoji-ipadic/base.dat.gz", bytes: 4 },
    ];
    const grouped = groupModelFiles(files, known);
    expect(grouped.vocal.map((f) => f.url)).toEqual([VOCAL[1]]);
    expect(grouped.beat.map((f) => f.url)).toEqual([BEAT]);
    expect(grouped.alignment.map((f) => f.url)).toHaveLength(2);
  });

  it("is empty for an empty cache", () => {
    expect(groupModelFiles([], known)).toEqual({ vocal: [], alignment: [], beat: [] });
  });
});

describe("modelFilesBytes", () => {
  it("sums every file", () => {
    expect(
      modelFilesBytes([
        { url: "a", bytes: 2 },
        { url: "b", bytes: 3 },
      ]),
    ).toBe(5);
  });
});

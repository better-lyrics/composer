import { describe, expect, it } from "vitest";
import { fileNameWithoutExtension } from "@/utils/file-name";

describe("fileNameWithoutExtension", () => {
  it("drops the final extension", () => {
    expect(fileNameWithoutExtension("Hey Jude.mp3")).toBe("Hey Jude");
  });

  describe("edge cases", () => {
    it("keeps dots inside the name", () => {
      expect(fileNameWithoutExtension("Mr. Brightside.v2.flac")).toBe("Mr. Brightside.v2");
    });

    it("leaves a name without an extension unchanged", () => {
      expect(fileNameWithoutExtension("untitled")).toBe("untitled");
    });

    it("handles unicode names", () => {
      expect(fileNameWithoutExtension("夜に駆ける.m4a")).toBe("夜に駆ける");
    });
  });
});

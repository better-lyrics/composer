import { describe, expect, it } from "vitest";
import { fileExtensionLabel, fileNameWithoutExtension } from "@/utils/file-name";

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

describe("fileExtensionLabel", () => {
  it("returns the extension in capitals", () => {
    expect(fileExtensionLabel("Midnight City.flac", "File")).toBe("FLAC");
    expect(fileExtensionLabel("a.b.m4a", "File")).toBe("M4A");
  });

  describe("edge cases", () => {
    it("falls back when there is no usable extension", () => {
      expect(fileExtensionLabel(undefined, "File")).toBe("File");
      expect(fileExtensionLabel("", "File")).toBe("File");
      expect(fileExtensionLabel("song", "AUDIO")).toBe("AUDIO");
      expect(fileExtensionLabel(".env", "File")).toBe("File");
      expect(fileExtensionLabel("trailing.", "File")).toBe("File");
    });
  });
});

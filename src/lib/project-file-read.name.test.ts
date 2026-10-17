import { PROJECT_FILE_ACCEPT, PROJECT_FILE_EXTENSIONS_LABEL, isProjectFileName } from "@/lib/project-file-read";
import { describe, expect, it } from "vitest";

describe("isProjectFileName", () => {
  it("recognizes a saved project and a plain JSON file", () => {
    expect(isProjectFileName("Midnight City.ttml-project.json")).toBe(true);
    expect(isProjectFileName("backup.json")).toBe(true);
  });

  it("rejects audio, lyrics and other files", () => {
    expect(isProjectFileName("song.mp3")).toBe(false);
    expect(isProjectFileName("lyrics.ttml")).toBe(false);
    expect(isProjectFileName("notes.txt")).toBe(false);
  });

  describe("edge cases", () => {
    it("ignores the case of the extension", () => {
      expect(isProjectFileName("BACKUP.JSON")).toBe(true);
    });

    it("needs the extension at the end of the name", () => {
      expect(isProjectFileName("song.json.mp3")).toBe(false);
      expect(isProjectFileName("json")).toBe(false);
      expect(isProjectFileName("")).toBe(false);
    });
  });
});

describe("PROJECT_FILE_EXTENSIONS_LABEL", () => {
  it("names the extension that covers every project file", () => {
    expect(PROJECT_FILE_EXTENSIONS_LABEL).toBe(".json");
  });

  describe("invariants", () => {
    it("covers every accepted extension", () => {
      const labelled = PROJECT_FILE_EXTENSIONS_LABEL.split(" ");
      for (const extension of PROJECT_FILE_ACCEPT.split(",")) {
        expect(
          labelled.some((label) => extension.endsWith(label)),
          extension,
        ).toBe(true);
      }
    });
  });
});

import { LYRICS_FILE_ACCEPT_ATTRIBUTE, SUPPORTED_LYRICS_FORMATS } from "@/domain/lyrics-file/supported-formats";
import { PROJECT_FILE_ACCEPT } from "@/lib/project-file-read";
import {
  LYRICS_IMPORT_ACCEPT_ATTRIBUTE,
  LYRICS_IMPORT_FORMATS_COMPACT,
  PROJECT_FILE_PROSE,
  UNSUPPORTED_LYRICS_IMPORT_MESSAGE,
  isLyricsImportFileName,
} from "@/views/lyrics-import-modal/accepted-files";
import { describe, expect, it } from "vitest";

describe("lyrics import accepted files", () => {
  it("offers every lyrics extension and every project file extension to file pickers", () => {
    expect(LYRICS_IMPORT_ACCEPT_ATTRIBUTE.split(",")).toEqual([
      ...LYRICS_FILE_ACCEPT_ATTRIBUTE.split(","),
      ...PROJECT_FILE_ACCEPT.split(","),
    ]);
    expect(LYRICS_IMPORT_ACCEPT_ATTRIBUTE).toContain(".ttml-project.json");
  });

  it("names every advertised lyrics format and the project file extension", () => {
    for (const format of SUPPORTED_LYRICS_FORMATS) expect(LYRICS_IMPORT_FORMATS_COMPACT).toContain(format.label);
    expect(LYRICS_IMPORT_FORMATS_COMPACT).toContain(".json");
  });

  it("tells the user a project file works too when a file is refused", () => {
    expect(UNSUPPORTED_LYRICS_IMPORT_MESSAGE).toBe(
      "Unsupported file type. Use .txt .lrc .srt .ttml .qrc or a project file (.json)",
    );
    expect(UNSUPPORTED_LYRICS_IMPORT_MESSAGE).toContain(PROJECT_FILE_PROSE);
  });

  it("accepts lyrics files and project files by name", () => {
    expect(isLyricsImportFileName("song.lrc")).toBe(true);
    expect(isLyricsImportFileName("wanderlust.xml")).toBe(true);
    expect(isLyricsImportFileName("Song-2026-10-01.ttml-project.json")).toBe(true);
    expect(isLyricsImportFileName("backup.json")).toBe(true);
  });

  describe("edge cases", () => {
    it("accepts uppercase extensions", () => {
      expect(isLyricsImportFileName("SONG.TTML")).toBe(true);
      expect(isLyricsImportFileName("SONG.JSON")).toBe(true);
    });

    it("refuses files that are neither lyrics nor projects", () => {
      expect(isLyricsImportFileName("cover.png")).toBe(false);
      expect(isLyricsImportFileName("song.mp3")).toBe(false);
      expect(isLyricsImportFileName("no-extension")).toBe(false);
      expect(isLyricsImportFileName("")).toBe(false);
    });

    it("never advertises the .xml alias", () => {
      expect(LYRICS_IMPORT_FORMATS_COMPACT).not.toContain(".xml");
      expect(UNSUPPORTED_LYRICS_IMPORT_MESSAGE).not.toContain(".xml");
    });
  });
});

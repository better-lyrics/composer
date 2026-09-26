import { describe, expect, it } from "vitest";
import { fileIdentityKey } from "@/utils/file-identity";

function audioFile(name: string, bytes: number, lastModified: number): File {
  return new File([new Uint8Array(bytes)], name, { type: "audio/wav", lastModified });
}

describe("fileIdentityKey", () => {
  it("matches two File objects for the same file on disk", () => {
    expect(fileIdentityKey(audioFile("song.wav", 8, 1000))).toBe(fileIdentityKey(audioFile("song.wav", 8, 1000)));
  });

  it("differs when the name differs", () => {
    expect(fileIdentityKey(audioFile("a.wav", 8, 1000))).not.toBe(fileIdentityKey(audioFile("b.wav", 8, 1000)));
  });

  it("differs when the size differs", () => {
    expect(fileIdentityKey(audioFile("song.wav", 8, 1000))).not.toBe(fileIdentityKey(audioFile("song.wav", 9, 1000)));
  });

  it("differs when the file was modified", () => {
    expect(fileIdentityKey(audioFile("song.wav", 8, 1000))).not.toBe(fileIdentityKey(audioFile("song.wav", 8, 2000)));
  });

  describe("edge cases", () => {
    it("handles an empty file with no name", () => {
      expect(fileIdentityKey(audioFile("", 0, 0))).toBe("|0|0");
    });

    it("keeps unicode names distinct", () => {
      expect(fileIdentityKey(audioFile("愛.wav", 8, 1000))).not.toBe(fileIdentityKey(audioFile("恋.wav", 8, 1000)));
    });
  });

  describe("invariants", () => {
    it("is stable across calls for the same File", () => {
      const file = audioFile("song.wav", 8, 1000);
      expect(fileIdentityKey(file)).toBe(fileIdentityKey(file));
    });
  });
});

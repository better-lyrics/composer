import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ACCEPTED_AUDIO_EXTENSIONS } from "@/domain/audio-file/supported-formats";
import { SUPPORTED_LYRICS_FORMATS } from "@/domain/lyrics-file/supported-formats";
import { PROJECT_FILE_EXTENSIONS } from "@/lib/project-file-read";
import { describe, expect, it } from "vitest";

// CI guard: the manifest is static, so a format added to an owner must also be registered with the OS.

// -- Types --------------------------------------------------------------------

interface FileHandler {
  action: string;
  name: string;
  accept: Record<string, string[]>;
}

// -- Constants ----------------------------------------------------------------

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MANIFEST = JSON.parse(readFileSync(resolve(ROOT, "public/manifest.webmanifest"), "utf8")) as {
  file_handlers: FileHandler[];
};

// .txt would offer Composer for every text file on the machine.
const UNREGISTERED_LYRICS = new Set(["txt"]);
// The spec caps an extension at 16 characters, and OSes match only the last one.
const MAX_EXTENSION_LENGTH = 16;

// -- Helpers ------------------------------------------------------------------

function extensionsOf(name: string): string[] {
  const handler = MANIFEST.file_handlers.find((entry) => entry.name === name);
  return Object.values(handler?.accept ?? {})
    .flat()
    .toSorted();
}

// -- Tests --------------------------------------------------------------------

describe("app manifest file handlers", () => {
  it("registers every lyrics format the importer reads", () => {
    const expected = SUPPORTED_LYRICS_FORMATS.map((format) => format.extension)
      .filter((extension) => !UNREGISTERED_LYRICS.has(extension))
      .map((extension) => `.${extension}`);
    expect(extensionsOf("Lyrics")).toEqual(expected.toSorted());
  });

  it("registers every single-part project extension", () => {
    const expected = PROJECT_FILE_EXTENSIONS.filter((extension) => extension.lastIndexOf(".") === 0);
    expect(extensionsOf("Composer project")).toEqual(expected.toSorted());
  });

  it("registers every audio format the player loads", () => {
    expect(extensionsOf("Audio")).toEqual(ACCEPTED_AUDIO_EXTENSIONS.map((extension) => `.${extension}`).toSorted());
  });

  it("keeps every extension within the length the spec allows", () => {
    const all = MANIFEST.file_handlers.flatMap((handler) => Object.values(handler.accept).flat());
    expect(all.filter((extension) => extension.length > MAX_EXTENSION_LENGTH)).toEqual([]);
  });
});

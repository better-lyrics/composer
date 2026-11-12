import { describe, expect, it } from "vitest";
import { matchLines, productionSources } from "@/test/source-scan";

// -- Constants ----------------------------------------------------------------

const OBJECT_STORE_ACCESS = /\bobjectStore\(|\bIDBObjectStore\b|\bIDBTransaction\b/;
const INLINE_BYTES_READ = /\.arrayBuffer\(\)/;
const MEDIA_WRITERS = ["lib/project-audio.ts", "lib/project-repository.ts", "lib/project-stems.ts"];

// -- Tests --------------------------------------------------------------------

describe("media is stored in IndexedDB as Blobs", () => {
  const storeModules = productionSources(".").filter(({ code }) => OBJECT_STORE_ACCESS.test(code));

  it("finds the media writers among the IndexedDB modules", () => {
    expect(storeModules.map(({ relPath }) => relPath)).toEqual(expect.arrayContaining(MEDIA_WRITERS));
  });

  it("never reads a file into inline bytes in a module that opens an object store", () => {
    const offenders = storeModules.flatMap(({ relPath, code }) =>
      matchLines(code, INLINE_BYTES_READ).map((line) => `src/${relPath}:${line}`),
    );
    expect(
      [
        ...offenders,
        ...(offenders.length === 0
          ? []
          : [
              "Chromium caps one IndexedDB value at 127 MiB, so a long song stored as an ArrayBuffer fails to save.",
              "Store the File or Blob itself (StoredData in domain/storage/stored-data.ts) and size it with storedDataBytes.",
            ]),
      ].join("\n"),
    ).toBe("");
  });
});

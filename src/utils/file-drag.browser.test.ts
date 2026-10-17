import { createAudioFile } from "@/test/audio-fixtures";
import { DRAGGED_LINK } from "@/test/file-drag";
import { isFileDrag } from "@/utils/file-drag";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

interface DragContents {
  files?: File[];
  data?: Record<string, string>;
}

function dataTransferWith({ files = [], data = {} }: DragContents): DataTransfer {
  const dataTransfer = new DataTransfer();
  for (const file of files) dataTransfer.items.add(file);
  for (const [format, value] of Object.entries(data)) dataTransfer.setData(format, value);
  return dataTransfer;
}

function imageFile(name = "thumbnail.jpg"): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff])], name, { type: "image/jpeg" });
}

const LINK = { "text/uri-list": DRAGGED_LINK };

// -- Tests --------------------------------------------------------------------

describe("isFileDrag", () => {
  it("is true for a dragged song file", () => {
    expect(isFileDrag(dataTransferWith({ files: [createAudioFile()] }))).toBe(true);
  });

  it("is true for a dragged image file without a link", () => {
    expect(isFileDrag(dataTransferWith({ files: [imageFile()] }))).toBe(true);
  });

  it("is false for a dragged link", () => {
    expect(isFileDrag(dataTransferWith({ data: LINK }))).toBe(false);
  });

  it("is false for dragged text", () => {
    expect(isFileDrag(dataTransferWith({ data: { "text/plain": DRAGGED_LINK } }))).toBe(false);
  });

  describe("edge cases", () => {
    it("is false for an empty drag", () => {
      expect(isFileDrag(new DataTransfer())).toBe(false);
    });

    it("is true for several files without a link", () => {
      const files = [createAudioFile("a.wav"), createAudioFile("b.wav")];
      expect(isFileDrag(dataTransferWith({ files }))).toBe(true);
    });

    it("is true for a linked file with no MIME type", () => {
      const untyped = new File([new Uint8Array([1])], "lyrics.ttml");
      expect(isFileDrag(dataTransferWith({ files: [untyped], data: LINK }))).toBe(true);
    });

    it("is false for a link that carries several images", () => {
      const files = [imageFile("a.jpg"), imageFile("b.png")];
      expect(isFileDrag(dataTransferWith({ files, data: LINK }))).toBe(false);
    });

    it("is true for a link that carries an image and a song", () => {
      const files = [imageFile(), createAudioFile()];
      expect(isFileDrag(dataTransferWith({ files, data: LINK }))).toBe(true);
    });
  });

  describe("regressions", () => {
    it("regression: a dragged linked thumbnail is a link drag, not a file drag", () => {
      expect(isFileDrag(dataTransferWith({ files: [imageFile()], data: LINK }))).toBe(false);
    });

    it("regression: a file drag that also carries a link still counts as a file drag", () => {
      expect(isFileDrag(dataTransferWith({ files: [createAudioFile()], data: LINK }))).toBe(true);
    });
  });

  describe("invariants", () => {
    it("does not change the drag contents", () => {
      const dataTransfer = dataTransferWith({ files: [imageFile()], data: LINK });
      const typesBefore = Array.from(dataTransfer.types);
      isFileDrag(dataTransfer);
      expect(Array.from(dataTransfer.types)).toEqual(typesBefore);
      expect(dataTransfer.items.length).toBe(2);
      expect(dataTransfer.getData("text/uri-list")).toBe(DRAGGED_LINK);
    });

    it("gives the same answer on every call", () => {
      const dataTransfer = dataTransferWith({ files: [createAudioFile()], data: LINK });
      expect([isFileDrag(dataTransfer), isFileDrag(dataTransfer)]).toEqual([true, true]);
    });

    it("does not depend on the order the link and the files were added", () => {
      const linkFirst = new DataTransfer();
      linkFirst.setData("text/uri-list", DRAGGED_LINK);
      linkFirst.items.add(imageFile());
      expect(isFileDrag(linkFirst)).toBe(isFileDrag(dataTransferWith({ files: [imageFile()], data: LINK })));
    });
  });
});

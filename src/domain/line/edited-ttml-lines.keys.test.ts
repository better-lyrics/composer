import { mergeEditedTtmlLines } from "@/domain/line/edited-ttml-lines";
import type { LyricLine } from "@/domain/line/model";
import { exportedTtml, mergeEditedExport } from "@/test/edited-ttml";
import { createLine } from "@/test/factories";
import { PARSERS } from "@/utils/lyrics-parsers";
import { lineKeyIds } from "@/utils/ttml-line-keys";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function paragraphs(ttml: string): string[] {
  return ttml.match(/<p [^>]*>[\s\S]*?<\/p>/g) ?? [];
}

function translated(id: string, text: string, begin: number, translation: string, origin: "manual" | "google") {
  return {
    ...createLine({ id, text, begin, end: begin + 1 }),
    translations: {
      es: { language: "es", text: translation, origin, sourceFingerprint: `fp-${id}`, stale: origin === "google" },
    },
  } satisfies LyricLine;
}

// -- Tests --------------------------------------------------------------------

describe("mergeEditedTtmlLines · pairing by line key", () => {
  describe("regressions: repeated lines", () => {
    it("regression: deleting the second of two identical lines keeps the first as stored", () => {
      const stored = [
        createLine({ id: "a", text: "Alpha", begin: 0, end: 1 }),
        translated("g1", "Let it go", 1, "Uno", "manual"),
        translated("g2", "Let it go", 2, "Dos", "google"),
        createLine({ id: "z", text: "Zulu", begin: 3, end: 4 }),
      ];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(paragraphs(ttml)[2] ?? "", ""));
      expect(merged.map((line) => line.id)).toEqual(["a", "g1", "z"]);
      expect(merged[1]).toBe(stored[1]);
    });

    it("regression: deleting the last of three identical lines keeps the other two as stored", () => {
      const stored = [
        translated("n1", "Na na na", 1, "Uno", "manual"),
        translated("n2", "Na na na", 2, "Dos", "manual"),
        translated("n3", "Na na na", 3, "Tres", "manual"),
      ];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(paragraphs(ttml)[2] ?? "", ""));
      expect(merged).toEqual([stored[0], stored[1]]);
    });

    it("regression: swapping two group instances and editing one keeps each instance's id and origin", () => {
      const stored = [
        { ...translated("c0", "Hold me", 1, "Abrázame", "google"), groupId: "g", instanceIdx: 0, templateLineIdx: 0 },
        { ...translated("c1", "Hold me", 2, "Abrázame", "manual"), groupId: "g", instanceIdx: 1, templateLineIdx: 0 },
      ];
      const merged = mergeEditedExport(stored, (ttml) => {
        const [first = "", second = ""] = paragraphs(ttml);
        const edited = first.replace(">Hold me<", ">Hold me closer<");
        return ttml.replace(first, "\u0000").replace(second, edited).replace("\u0000", second);
      });
      expect(merged.map((line) => [line.id, line.text])).toEqual([
        ["c1", "Hold me"],
        ["c0", "Hold me closer"],
      ]);
      expect(merged[0]).toBe(stored[1]);
      expect(merged[1]?.translations?.es).toEqual(stored[0]?.translations?.es);
    });
  });

  describe("regressions: copied paragraphs", () => {
    it("regression: a copied paragraph becomes a new line and the original keeps its translation", () => {
      const stored = [translated("b", "Bravo", 1, "Bravo es", "manual")];
      const merged = mergeEditedExport(stored, (ttml) => {
        const [original = ""] = paragraphs(ttml);
        return ttml.replace(original, `${original}${original.replace(">Bravo<", ">Bravo again<")}`);
      });
      expect(merged[0]).toBe(stored[0]);
      expect(merged[1]?.text).toBe("Bravo again");
      expect(merged[1]?.id).not.toBe("b");
      expect(merged[1]?.translations).toBeUndefined();
    });
  });

  describe("regressions: a paragraph copied above its original", () => {
    it("regression: the untouched original keeps its id and translation, the copy is new", () => {
      const stored = [
        createLine({ id: "c", text: "Charlie", begin: 1, end: 2 }),
        translated("d", "Delta", 3, "D es", "manual"),
      ];
      const merged = mergeEditedExport(stored, (ttml) => {
        const [charlie = "", delta = ""] = paragraphs(ttml);
        return ttml.replace(charlie, `${delta.replace(">Delta<", ">Delta copy<")}${charlie}`);
      });
      expect(merged.map((line) => line.text)).toEqual(["Delta copy", "Charlie", "Delta"]);
      expect(merged[2]).toBe(stored[1]);
      expect(merged[0]?.id).not.toBe("d");
      expect(merged[0]?.translations).toBeUndefined();
    });

    it("pairs the first copy when no copy exports like the stored line", () => {
      const stored = [translated("d", "Delta", 3, "D es", "manual")];
      const merged = mergeEditedExport(stored, (ttml) => {
        const [delta = ""] = paragraphs(ttml);
        return ttml.replace(
          delta,
          `${delta.replace(">Delta<", ">Delta one<")}${delta.replace(">Delta<", ">Delta two<")}`,
        );
      });
      expect(merged.map((line) => [line.id, line.text])).toEqual([
        ["d", "Delta one"],
        [merged[1]?.id, "Delta two"],
      ]);
      expect(merged[1]?.id).not.toBe("d");
      expect(merged[0]?.translations?.es).toEqual(stored[0]?.translations?.es);
    });
  });

  describe("regressions: keys from an older export", () => {
    it("regression: pairs through the key map of the export the edit came from", () => {
      const before = [
        translated("a", "Alpha", 1, "Uno", "manual"),
        translated("b", "Bravo", 2, "Dos", "google"),
        translated("c", "Charlie", 3, "Tres", "manual"),
      ];
      const content = exportedTtml(before).replace(">Charlie<", ">Charlie!<");
      const now = [before[0], before[2]].filter((line) => line !== undefined);
      const merged = mergeEditedTtmlLines(now, PARSERS.ttml(content), lineKeyIds(before));
      expect(merged[0]).toBe(now[0]);
      expect(merged[1]?.id).not.toBe("c");
      expect(merged[1]?.text).toBe("Bravo");
      expect(merged[2]).toMatchObject({ id: "c", text: "Charlie!", translations: before[2]?.translations });
    });
  });

  describe("regressions: lines the edit never knew", () => {
    it("regression: keeps a stored line the edit's key map never had, after its preceding line", () => {
      const before = [translated("a", "Alpha", 1, "Uno", "manual"), translated("c", "Charlie", 3, "Tres", "manual")];
      const content = exportedTtml(before).replace(">Charlie<", ">Charlie!<");
      const bravo = translated("b", "Bravo", 2, "Dos", "google");
      const now = [before[0], bravo, before[1]].filter((line) => line !== undefined);
      const merged = mergeEditedTtmlLines(now, PARSERS.ttml(content), lineKeyIds(before));
      expect(merged.map((line) => line.id)).toEqual(["a", "b", "c"]);
      expect(merged[1]).toBe(bravo);
      expect(merged[2]?.text).toBe("Charlie!");
    });

    it("still deletes a line the edit knew and no longer holds", () => {
      const before = [translated("a", "Alpha", 1, "Uno", "manual"), translated("b", "Bravo", 2, "Dos", "google")];
      const content = exportedTtml(before).replace(paragraphs(exportedTtml(before))[1] ?? "", "");
      expect(mergeEditedTtmlLines(before, PARSERS.ttml(content), lineKeyIds(before)).map((line) => line.id)).toEqual([
        "a",
      ]);
    });
  });
});

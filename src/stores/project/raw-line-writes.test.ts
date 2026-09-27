import { describe, expect, expectTypeOf, it } from "vitest";
import { getEffectiveLines } from "@/domain/line/effective-words";
import type { RawLine } from "@/domain/line/model";
import type { commitHistory } from "@/stores/project/history-helpers";
import type { ProjectStore } from "@/stores/project/types";
import { createLine } from "@/test/factories";

type ImportedLines = Parameters<ProjectStore["replaceLyricsWithHistory"]>[0]["lines"];
type CommittedLines = NonNullable<Parameters<typeof commitHistory>[1]["lines"]>;

describe("history writers take raw lines only", () => {
  describe("invariants", () => {
    it("replaceLyricsWithHistory rejects effective lines", () => {
      const effective = getEffectiveLines([createLine({ text: "verse", begin: 5, end: 7 })]);
      expect(effective[0].words).toHaveLength(1);
      expectTypeOf([...effective]).not.toMatchTypeOf<ImportedLines>();
      expectTypeOf<ImportedLines>().toEqualTypeOf<RawLine[]>();
    });

    it("commitHistory rejects effective lines", () => {
      const effective = getEffectiveLines([createLine({ text: "verse", begin: 5, end: 7 })]);
      expectTypeOf([...effective]).not.toMatchTypeOf<CommittedLines>();
      expectTypeOf<CommittedLines>().toEqualTypeOf<RawLine[]>();
    });
  });
});

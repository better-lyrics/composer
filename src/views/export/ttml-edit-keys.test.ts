import { createLine } from "@/test/factories";
import { generateTTML } from "@/utils/ttml";
import { lineKeyIds } from "@/utils/ttml-line-keys";
import { contentLineKeyIds, keptTtmlEdits, startedTtmlEdit } from "@/views/export/ttml-edit-keys";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const ALPHA = createLine({ id: "a", text: "Alpha", begin: 1, end: 2 });
const BRAVO = createLine({ id: "b", text: "Bravo", begin: 2, end: 3 });
const CHARLIE = createLine({ id: "c", text: "Charlie", begin: 3, end: 4 });

function exported(lines: Parameters<typeof generateTTML>[0]["lines"]): string {
  return generateTTML({ metadata: { title: "Song", artists: [], album: "", duration: 0 }, agents: [], lines });
}

// -- Tests --------------------------------------------------------------------

describe("startedTtmlEdit", () => {
  it("records the numbering of the export the edit starts from", () => {
    const generated = exported([ALPHA, BRAVO]);
    expect(startedTtmlEdit(null, generated, "edited", [ALPHA, BRAVO])).toEqual({
      source: generated,
      content: "edited",
      lineKeyIds: { L1: "a", L2: "b" },
    });
  });

  it("regression: keeps the lines an unchanged edit knew when the edit continues", () => {
    const generated = exported([ALPHA, BRAVO, CHARLIE]);
    const previous = { source: generated, content: "kept", lineKeyIds: { L1: "a", L3: "c" } };
    expect(startedTtmlEdit(previous, generated, "typed", [ALPHA, BRAVO, CHARLIE]).lineKeyIds).toEqual({
      L1: "a",
      L3: "c",
    });
  });

  it("keeps an unknown numbering unknown", () => {
    const stale = { source: "old", content: "old edit", lineKeyIds: null };
    expect(startedTtmlEdit(stale, "new", "edited", [ALPHA]).lineKeyIds).toBeNull();
  });
});

describe("keptTtmlEdits", () => {
  it("moves the edit's keys to the numbering of the current export", () => {
    const before = [ALPHA, BRAVO, CHARLIE];
    const edit = startedTtmlEdit(null, exported(before), exported(before).replace(">Charlie<", ">Charlie!<"), before);
    const now = [ALPHA, CHARLIE];
    const kept = keptTtmlEdits(edit, exported(now), now);
    expect(kept.source).toBe(exported(now));
    expect(kept.lineKeyIds).toEqual({ L1: "a", L2: "c" });
    expect(kept.content).toContain('itunes:key="L2" ttm:agent="v1">Charlie!<');
    expect(kept.content).toContain('itunes:key="N1" ttm:agent="v1">Bravo<');
  });

  describe("regressions", () => {
    it("regression: records only the lines the kept edit knew", () => {
      const before = [ALPHA, CHARLIE];
      const edit = startedTtmlEdit(null, exported(before), exported(before), before);
      const now = [ALPHA, BRAVO, CHARLIE];
      expect(keptTtmlEdits(edit, exported(now), now).lineKeyIds).toEqual({ L1: "a", L3: "c" });
    });

    it("regression: marks the keys unknown for a saved edit without a numbering", () => {
      const kept = keptTtmlEdits({ source: "older export", content: "old edit" }, exported([ALPHA]), [ALPHA]);
      expect(kept).toEqual({ source: exported([ALPHA]), content: "old edit", lineKeyIds: null });
    });
  });
});

describe("contentLineKeyIds", () => {
  it("uses the numbering recorded with the edit for the edit's own content", () => {
    const edit = { source: "s", content: "c", lineKeyIds: { L1: "b" } };
    expect(contentLineKeyIds(edit, "c", [ALPHA], exported([ALPHA]))).toEqual({ L1: "b" });
  });

  it("uses the current numbering for content that is not the saved edit", () => {
    const edit = { source: "s", content: "c", lineKeyIds: { L1: "b" } };
    expect(contentLineKeyIds(edit, "rebased", [ALPHA], exported([ALPHA]))).toEqual(lineKeyIds([ALPHA]));
    expect(contentLineKeyIds(null, "typed", [ALPHA], exported([ALPHA]))).toEqual(lineKeyIds([ALPHA]));
  });

  describe("regressions", () => {
    it("regression: derives the numbering of a saved edit without one only when its source is the current export", () => {
      const generated = exported([ALPHA]);
      expect(contentLineKeyIds({ source: generated, content: "c" }, "c", [ALPHA], generated)).toEqual({ L1: "a" });
      expect(contentLineKeyIds({ source: "older export", content: "c" }, "c", [ALPHA], generated)).toBeNull();
    });

    it("regression: keeps unknown keys unknown even for rebased content", () => {
      const edit = { source: "s", content: "c", lineKeyIds: null };
      expect(contentLineKeyIds(edit, "rebased", [ALPHA], exported([ALPHA]))).toBeNull();
    });
  });
});

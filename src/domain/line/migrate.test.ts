import type { NestedLyricLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";
import type { WordTiming } from "@/domain/word/timing";
import { migrateLine } from "@/domain/line/migrate";

// -- Fixtures -----------------------------------------------------------------

const helloWords: WordTiming[] = [
  { text: "Hel", begin: 1.2, end: 1.6 },
  { text: "lo ", begin: 1.6, end: 2.1 },
  { text: "world", begin: 2.1, end: 2.9 },
];

const ahWords: WordTiming[] = [
  { text: "ah ", begin: 6.0, end: 7.2 },
  { text: "oh", begin: 7.2, end: 8.5 },
];

const wordSyncedFlat = {
  id: "l1",
  agentId: "v1",
  text: "Hello world",
  words: helloWords,
  groupId: "g1",
  instanceIdx: 0,
  templateLineIdx: 2,
  detached: true,
};

const lineSyncedFlat = {
  id: "l2",
  agentId: "v2",
  text: "Hello world",
  begin: 3.0,
  end: 7.5,
};

const untimedFlat = {
  id: "l3",
  agentId: "v1",
  text: "Hello world",
};

const bgWithWordsFlat = {
  id: "l4",
  agentId: "v1",
  text: "Hello world",
  begin: 3.0,
  end: 7.5,
  backgroundText: "ah oh",
  backgroundWords: ahWords,
  backgroundTextSource: "extraction" as const,
};

const bgWithoutWordsFlat = {
  id: "l5",
  agentId: "v1",
  text: "Hello world",
  backgroundText: "ah oh",
  backgroundTextSource: "manual" as const,
};

const noBgFlat = {
  id: "l6",
  agentId: "v1",
  text: "Hello world",
  begin: 3.0,
  end: 7.5,
};

// -- migrateLine: happy paths -------------------------------------------------

describe("migrateLine", () => {
  describe("happy paths", () => {
    it("migrates a word-synced flat line to a nested word voice", () => {
      const result = migrateLine(wordSyncedFlat);
      expect(result).toEqual({
        id: "l1",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 2,
        detached: true,
        main: { text: "Hello world", words: helloWords },
      });
    });

    it("preserves the words array by reference", () => {
      const result = migrateLine(wordSyncedFlat);
      if (!("words" in result.main)) throw new Error("expected a word voice");
      expect(result.main.words).toBe(helloWords);
    });

    it("migrates a line-synced flat line to a nested line voice", () => {
      const result = migrateLine(lineSyncedFlat);
      expect(result).toEqual({
        id: "l2",
        agentId: "v2",
        main: { text: "Hello world", begin: 3.0, end: 7.5 },
      });
    });

    it("migrates an untimed flat line to a nested untimed voice", () => {
      const result = migrateLine(untimedFlat);
      expect(result).toEqual({
        id: "l3",
        agentId: "v1",
        main: { text: "Hello world" },
      });
    });

    it("migrates an empty-text untimed flat line", () => {
      const result = migrateLine({ id: "l7", agentId: "v1", text: "" });
      expect(result).toEqual({ id: "l7", agentId: "v1", main: { text: "" } });
    });

    it("migrates a flat line with word-synced background", () => {
      const result = migrateLine(bgWithWordsFlat);
      expect(result).toEqual({
        id: "l4",
        agentId: "v1",
        main: { text: "Hello world", begin: 3.0, end: 7.5 },
        background: { text: "ah oh", words: ahWords, source: "extraction" },
      });
    });

    it("migrates a flat line with untimed background", () => {
      const result = migrateLine(bgWithoutWordsFlat);
      expect(result).toEqual({
        id: "l5",
        agentId: "v1",
        main: { text: "Hello world" },
        background: { text: "ah oh", source: "manual" },
      });
    });

    it("omits the background key entirely for a line with no background", () => {
      const result = migrateLine(noBgFlat);
      expect(result).toEqual({
        id: "l6",
        agentId: "v1",
        main: { text: "Hello world", begin: 3.0, end: 7.5 },
      });
      expect("background" in result).toBe(false);
    });
  });

  // -- migrateLine: edge cases ------------------------------------------------

  describe("edge cases", () => {
    it("treats begin: 0 as line-synced (guards against falsy-begin bug)", () => {
      const result = migrateLine({ id: "l8", agentId: "v1", text: "zero", begin: 0, end: 1.5 });
      expect(result.main).toEqual({ text: "zero", begin: 0, end: 1.5 });
    });

    it("builds an empty-text word-synced background when only backgroundWords are set", () => {
      const result = migrateLine({
        id: "l9",
        agentId: "v1",
        text: "Hello world",
        backgroundWords: ahWords,
      });
      expect(result.background).toEqual({ text: "", words: ahWords, source: undefined });
      if (result.background === undefined || !("words" in result.background)) {
        throw new Error("expected a word-synced background voice");
      }
      expect(result.background.words).toBe(ahWords);
    });

    it("treats an empty backgroundWords array as no background", () => {
      const result = migrateLine({
        id: "l10",
        agentId: "v1",
        text: "Hello world",
        backgroundWords: [],
      });
      expect("background" in result).toBe(false);
    });

    it("prefers words over stale begin/end on the main voice", () => {
      const result = migrateLine({
        id: "l11",
        agentId: "v1",
        text: "Hello world",
        begin: 0,
        end: 999,
        words: helloWords,
      });
      expect(result.main).toEqual({ text: "Hello world", words: helloWords });
      if (!("words" in result.main)) throw new Error("expected a word voice");
      expect(result.main.words).toBe(helloWords);
    });

    it("preserves unicode text verbatim", () => {
      const result = migrateLine({ id: "l12", agentId: "v1", text: "안녕 🎵", begin: 2, end: 4 });
      expect(result.main).toEqual({ text: "안녕 🎵", begin: 2, end: 4 });
    });
  });

  // -- migrateLine: invariants ------------------------------------------------

  describe("invariants", () => {
    it("preserves all defined identity fields", () => {
      const result = migrateLine(wordSyncedFlat);
      expect(result.id).toBe("l1");
      expect(result.agentId).toBe("v1");
      expect(result.groupId).toBe("g1");
      expect(result.instanceIdx).toBe(0);
      expect(result.templateLineIdx).toBe(2);
      expect(result.detached).toBe(true);
    });

    it("does not emit absent identity fields as undefined keys", () => {
      const result = migrateLine(untimedFlat);
      expect("groupId" in result).toBe(false);
      expect("instanceIdx" in result).toBe(false);
      expect("templateLineIdx" in result).toBe(false);
      expect("detached" in result).toBe(false);
    });

    it("preserves instanceIdx: 0 (guards against falsy-index drop)", () => {
      const result = migrateLine({ id: "l13", agentId: "v1", text: "x", instanceIdx: 0, groupId: "g9" });
      expect(result.instanceIdx).toBe(0);
      expect(result.groupId).toBe("g9");
    });

    it("preserves detached: false explicitly", () => {
      const result = migrateLine({ id: "l14", agentId: "v1", text: "x", detached: false });
      expect(result.detached).toBe(false);
    });

    it.each([
      ["word-synced", wordSyncedFlat],
      ["line-synced", lineSyncedFlat],
      ["untimed", untimedFlat],
      ["bg-with-words", bgWithWordsFlat],
      ["bg-without-words", bgWithoutWordsFlat],
      ["no-bg", noBgFlat],
    ])("is idempotent for a %s flat line", (_label, flat) => {
      const once = migrateLine(flat);
      const twice = migrateLine(once);
      expect(twice).toEqual(once);
    });
  });

  // -- migrateLine: error paths -----------------------------------------------

  describe("error paths", () => {
    it("throws for null input", () => {
      expect(() => migrateLine(null)).toThrow();
    });

    it("throws for a number input", () => {
      expect(() => migrateLine(42)).toThrow();
    });

    it("throws for a string input", () => {
      expect(() => migrateLine("not a line")).toThrow();
    });

    it("throws for an empty object (missing id and agentId)", () => {
      expect(() => migrateLine({})).toThrow();
    });

    it("throws for a flat object missing text", () => {
      expect(() => migrateLine({ id: "l1", agentId: "v1" })).toThrow();
    });

    it("throws for a flat object with a non-string id", () => {
      expect(() => migrateLine({ id: 1, agentId: "v1", text: "x" })).toThrow();
    });

    it("throws for a flat object missing agentId", () => {
      expect(() => migrateLine({ id: "l1", text: "x" })).toThrow();
    });

    it("throws for a nested object whose main has no text", () => {
      expect(() => migrateLine({ id: "l1", agentId: "v1", main: { begin: 1, end: 2 } })).toThrow();
    });

    it("throws for a nested object whose main is not an object", () => {
      expect(() => migrateLine({ id: "l1", agentId: "v1", main: "x" })).toThrow();
    });
  });

  // -- migrateLine: nested passthrough ----------------------------------------

  describe("nested passthrough", () => {
    it("preserves a nested word voice verbatim", () => {
      const nested: NestedLyricLine = {
        id: "n1",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 3,
        main: { text: "Hello world", words: helloWords },
        background: { text: "ah oh", words: ahWords, source: "extraction" },
      };
      const result = migrateLine(nested);
      expect(result).toEqual(nested);
      if (!("words" in result.main)) throw new Error("expected a word voice");
      expect(result.main.words).toBe(helloWords);
    });

    it("preserves a nested untimed voice with no background", () => {
      const nested: NestedLyricLine = { id: "n2", agentId: "v2", main: { text: "Hello" } };
      const result = migrateLine(nested);
      expect(result).toEqual(nested);
      expect("background" in result).toBe(false);
    });

    it("does not emit absent identity fields as undefined keys on the nested branch", () => {
      const nested: NestedLyricLine = { id: "n3", agentId: "v1", main: { text: "x", begin: 1, end: 2 } };
      const result = migrateLine(nested);
      expect("groupId" in result).toBe(false);
      expect("instanceIdx" in result).toBe(false);
      expect("templateLineIdx" in result).toBe(false);
      expect("detached" in result).toBe(false);
    });
  });
});

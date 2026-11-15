/**
 * @vitest-environment node
 */
import { fieldsOfLine, lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "insync/line";
import { describe, expect, it } from "vitest";
import { findMatchingTemplate, linesStructurallyEqual, structurallyEqualLineSequences } from "./structural-match";
import { DEFAULT_SPLIT_CHARACTER } from "@/utils/split-character-text";

const baseLine: LyricLine = lineFromFields({ id: "x", text: "I love you", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER);

describe("linesStructurallyEqual", () => {
  it("equal when text/agentId/words/bg match", () => {
    const a: LyricLine = lineFromFields(
      {
        ...fieldsOfLine(baseLine, DEFAULT_SPLIT_CHARACTER),
        words: [
          { id: "w1", text: "I", sep: " ", begin: 0, end: 1, joinsNext: false },
          { id: "w2", text: "love", sep: "", begin: 1, end: 2, joinsNext: false },
        ],
      },
      DEFAULT_SPLIT_CHARACTER,
    );
    const b: LyricLine = lineFromFields(
      {
        ...fieldsOfLine(baseLine, DEFAULT_SPLIT_CHARACTER),
        id: "y",
        words: [
          { id: "w3", text: "I", sep: " ", begin: 30, end: 31, joinsNext: false },
          { id: "w4", text: "love", sep: "", begin: 31, end: 32, joinsNext: false },
        ],
      },
      DEFAULT_SPLIT_CHARACTER,
    );
    expect(linesStructurallyEqual(a, b)).toBe(true);
  });

  it("unequal when text differs", () => {
    expect(
      linesStructurallyEqual(
        baseLine,
        lineFromFields(
          { ...fieldsOfLine(baseLine, DEFAULT_SPLIT_CHARACTER), text: "different" },
          DEFAULT_SPLIT_CHARACTER,
        ),
      ),
    ).toBe(false);
  });

  it("unequal when agent differs", () => {
    expect(
      linesStructurallyEqual(
        baseLine,
        lineFromFields({ ...fieldsOfLine(baseLine, DEFAULT_SPLIT_CHARACTER), agentId: "v2" }, DEFAULT_SPLIT_CHARACTER),
      ),
    ).toBe(false);
  });

  it("equal when one line is synced word by word and the other is not", () => {
    const a: LyricLine = lineFromFields(
      {
        ...fieldsOfLine(baseLine, DEFAULT_SPLIT_CHARACTER),
        words: [
          { id: "w5", text: "I", sep: " ", begin: 0, end: 1, joinsNext: false },
          { id: "w6", text: "love", sep: " ", begin: 1, end: 2, joinsNext: false },
        ],
      },
      DEFAULT_SPLIT_CHARACTER,
    );
    expect(linesStructurallyEqual(a, { ...baseLine, id: "y" })).toBe(true);
  });

  it("equal when one line is only partly synced word by word", () => {
    const a: LyricLine = lineFromFields(
      {
        ...fieldsOfLine(baseLine, DEFAULT_SPLIT_CHARACTER),
        words: [
          { id: "w7", text: "I", sep: " ", begin: 0, end: 1, joinsNext: false },
          { id: "w8", text: "love", sep: "", begin: 1, end: 2, joinsNext: false },
        ],
      },
      DEFAULT_SPLIT_CHARACTER,
    );
    const b: LyricLine = lineFromFields(
      {
        ...fieldsOfLine(baseLine, DEFAULT_SPLIT_CHARACTER),
        words: [{ id: "w9", text: "I", sep: " ", begin: 0, end: 1, joinsNext: false }],
      },
      DEFAULT_SPLIT_CHARACTER,
    );
    expect(linesStructurallyEqual(a, b)).toBe(true);
  });

  it("unequal when the syllable split of the text differs", () => {
    expect(
      linesStructurallyEqual(
        baseLine,
        lineFromFields(
          { ...fieldsOfLine(baseLine, DEFAULT_SPLIT_CHARACTER), text: "I lo|ve you" },
          DEFAULT_SPLIT_CHARACTER,
        ),
      ),
    ).toBe(false);
  });

  it("unequal when background differs", () => {
    const a: LyricLine = lineFromFields(
      { ...fieldsOfLine(baseLine, DEFAULT_SPLIT_CHARACTER), backgroundText: "yeah" },
      DEFAULT_SPLIT_CHARACTER,
    );
    const b: LyricLine = lineFromFields(
      { ...fieldsOfLine(baseLine, DEFAULT_SPLIT_CHARACTER), backgroundText: "yeah yeah" },
      DEFAULT_SPLIT_CHARACTER,
    );
    expect(linesStructurallyEqual(a, b)).toBe(false);
  });
});

describe("structurallyEqualLineSequences", () => {
  it("matches sequences with same structure but different timings", () => {
    const a: LyricLine[] = [
      lineFromFields(
        {
          id: "1",
          text: "I love",
          agentId: "v1",
          words: [{ id: "w10", text: "I", sep: "", begin: 0, end: 1, joinsNext: false }],
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
      lineFromFields(
        {
          id: "2",
          text: "you",
          agentId: "v1",
          words: [{ id: "w11", text: "you", sep: "", begin: 1, end: 2, joinsNext: false }],
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
    ];
    const b: LyricLine[] = [
      lineFromFields(
        {
          id: "x",
          text: "I love",
          agentId: "v1",
          words: [{ id: "w12", text: "I", sep: "", begin: 30, end: 31, joinsNext: false }],
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
      lineFromFields(
        {
          id: "y",
          text: "you",
          agentId: "v1",
          words: [{ id: "w13", text: "you", sep: "", begin: 31, end: 32, joinsNext: false }],
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
    ];
    expect(structurallyEqualLineSequences(a, b)).toBe(true);
  });

  it("rejects different line counts", () => {
    const a: LyricLine[] = [lineFromFields({ id: "1", text: "I", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER)];
    const b: LyricLine[] = [
      lineFromFields({ id: "1", text: "I", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
      lineFromFields({ id: "2", text: "you", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
    ];
    expect(structurallyEqualLineSequences(a, b)).toBe(false);
  });
});

describe("findMatchingTemplate", () => {
  it("finds a matching instance template in the project", () => {
    const projectLines: LyricLine[] = [
      lineFromFields(
        {
          id: "a",
          text: "I love",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [{ id: "w14", text: "I love", sep: "", begin: 0, end: 2, joinsNext: false }],
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
      lineFromFields(
        {
          id: "b",
          text: "you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 1,
          words: [{ id: "w15", text: "you", sep: "", begin: 2, end: 3, joinsNext: false }],
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
    ];
    const candidate: LyricLine[] = [
      lineFromFields(
        {
          id: "p",
          text: "I love",
          agentId: "v1",
          words: [{ id: "w16", text: "I love", sep: "", begin: 30, end: 32, joinsNext: false }],
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
      lineFromFields(
        {
          id: "q",
          text: "you",
          agentId: "v1",
          words: [{ id: "w17", text: "you", sep: "", begin: 32, end: 33, joinsNext: false }],
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
    ];
    const found = findMatchingTemplate(candidate, projectLines);
    expect(found).toEqual({ groupId: "g1", instanceIdx: 0 });
  });

  it("returns null when no match", () => {
    const projectLines: LyricLine[] = [
      lineFromFields(
        {
          id: "a",
          text: "I love",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [{ id: "w18", text: "I love", sep: "", begin: 0, end: 2, joinsNext: false }],
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
    ];
    const candidate: LyricLine[] = [
      lineFromFields({ id: "p", text: "different text", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
    ];
    expect(findMatchingTemplate(candidate, projectLines)).toBeNull();
  });
});

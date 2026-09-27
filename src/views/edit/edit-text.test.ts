import { describe, expect, it } from "vitest";
import { reconcileLine } from "@/domain/line/model";
import { editTextWithRewrittenRows, linesToEditText, shiftCaretPastRewrittenRows } from "@/views/edit/edit-text";

const line = (id: string, text: string) => reconcileLine({ id, text, agentId: "v1" });

describe("linesToEditText", () => {
  it("joins line texts with newlines", () => {
    expect(linesToEditText([line("a", "One"), line("b", ""), line("c", "Two")])).toBe("One\n\nTwo");
  });

  it("returns an empty string for no lines", () => {
    expect(linesToEditText([])).toBe("");
  });
});

describe("editTextWithRewrittenRows", () => {
  it("keeps every typed row when nothing was rewritten", () => {
    const typedLines = [line("a", "One"), line("b", "Two")];
    expect(editTextWithRewrittenRows("One  \nTwo", typedLines, typedLines)).toBe("One  \nTwo");
  });

  it("replaces only the rows another line rewrote", () => {
    const typedLines = [line("a", "Chorus x"), line("b", "Verse"), line("c", "Chorus")];
    const finalLines = [typedLines[0], typedLines[1], line("c", "Chorus x")];
    expect(editTextWithRewrittenRows("Chorus x \nVerse\nChorus", typedLines, finalLines)).toBe(
      "Chorus x \nVerse\nChorus x",
    );
  });
});

describe("shiftCaretPastRewrittenRows", () => {
  it("keeps the caret when only rows after it changed", () => {
    expect(shiftCaretPastRewrittenRows("ab\ncd", "ab\ncdef", 1)).toBe(1);
  });

  it("shifts the caret by the growth of every row before it", () => {
    expect(shiftCaretPastRewrittenRows("a\nb\ncd", "abc\nb\ncd", 5)).toBe(7);
  });

  it("shifts the caret back when a row before it shrinks", () => {
    expect(shiftCaretPastRewrittenRows("abcd\nxy", "a\nxy", 7)).toBe(4);
  });

  it("does not count the caret's own row", () => {
    expect(shiftCaretPastRewrittenRows("ab\ncd", "ab\ncdxyz", 4)).toBe(4);
  });

  it("treats a caret at a row start as belonging to that row", () => {
    expect(shiftCaretPastRewrittenRows("a\nb", "abc\nb", 2)).toBe(4);
  });

  it("keeps the caret when the displayed text has fewer rows than the typed text", () => {
    expect(shiftCaretPastRewrittenRows("ab\n(oh)\ncd", "ab (oh)\ncd", 9)).toBe(9);
  });

  it("keeps the caret when the displayed text has more rows than the typed text", () => {
    expect(shiftCaretPastRewrittenRows("a\nb", "abc\nb\nc", 3)).toBe(3);
  });
});

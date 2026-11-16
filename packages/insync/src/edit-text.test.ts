import { lineFromFields } from "./line-from-fields";
import { describe, expect, it } from "vitest";

import { editTextWithRewrittenRows, linesToEditText, shiftCaretPastRewrittenRows } from "./edit-text";
import { DEFAULT_SPLIT_CHARACTER } from "./split-character-text";

const line = (id: string, text: string) => lineFromFields({ id, text, agentId: "v1" }, DEFAULT_SPLIT_CHARACTER);

describe("linesToEditText", () => {
  it("joins line texts with newlines", () => {
    expect(linesToEditText([line("a", "One"), line("b", ""), line("c", "Two")], DEFAULT_SPLIT_CHARACTER)).toBe(
      "One\n\nTwo",
    );
  });

  it("returns an empty string for no lines", () => {
    expect(linesToEditText([], DEFAULT_SPLIT_CHARACTER)).toBe("");
  });
});

describe("editTextWithRewrittenRows", () => {
  it("keeps every typed row when nothing was rewritten", () => {
    const typedLines = [line("a", "One"), line("b", "Two")];
    expect(editTextWithRewrittenRows("One  \nTwo", typedLines, typedLines, DEFAULT_SPLIT_CHARACTER)).toBe("One  \nTwo");
  });

  it("replaces only the rows another line rewrote", () => {
    const typedLines = [line("a", "Chorus x"), line("b", "Verse"), line("c", "Chorus")];
    const finalLines = [typedLines[0], typedLines[1], line("c", "Chorus x")];
    expect(editTextWithRewrittenRows("Chorus x \nVerse\nChorus", typedLines, finalLines, DEFAULT_SPLIT_CHARACTER)).toBe(
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

  it("regression: a join that moves the background behind the joined words keeps the caret where the rows met", () => {
    expect(shiftCaretPastRewrittenRows("love (away)you\nlove (away)", "love you (away)\nlove (away)", 11)).toBe(5);
  });

  it("regression: a join that moves a background group before the caret keeps the caret where the rows met", () => {
    const typed = "bloom (tide) sigh mead|ow sighhar|bor sigh yon|der (sigh hum)";
    const shown = "bloom sigh mead|ow sighhar|bor sigh yon|der (tide) (sigh hum)";
    const caret = typed.indexOf("har|bor");
    expect(shiftCaretPastRewrittenRows(typed, shown, caret)).toBe(shown.indexOf("har|bor"));
  });

  it("regression: a group extracted as it closes leaves the caret after the main text the user typed", () => {
    const typed = "rain (tide) glow\nnext";
    const shown = "rain glow (tide)\nnext";
    expect(shiftCaretPastRewrittenRows(typed, shown, typed.indexOf(" glow"))).toBe("rain ".length);
  });

  it("regression: a dangling split mark cleaned at the row start keeps the caret after the same letters", () => {
    expect(shiftCaretPastRewrittenRows("|rain glow", "rain glow", "|rain gl".length)).toBe("rain gl".length);
  });

  it("regression: a background row merged into the row above keeps the caret on the row it was on", () => {
    const typed = "dusk tide\n  (low hum)\nember";
    const shown = "dusk tide (low hum)\nember";
    expect(shiftCaretPastRewrittenRows(typed, shown, typed.indexOf("ember"))).toBe(shown.indexOf("ember"));
  });

  it("regression: a row the redraw left as typed keeps the caret right after a group typed in it", () => {
    const typed = "bloom (tide) sigh\nhar|bor";
    expect(shiftCaretPastRewrittenRows(typed, "bloom (tide) sigh\nharbor", "bloom (tide)".length)).toBe(
      "bloom (tide)".length,
    );
  });
});

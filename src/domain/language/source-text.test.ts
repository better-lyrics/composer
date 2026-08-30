import { languageSourceText } from "@/domain/language/source-text";
import { describe, expect, it } from "vitest";

describe("languageSourceText", () => {
  it("removes structural syllable markers without removing lexical spaces", () => {
    expect(languageSourceText("  今|は 当|然  ")).toBe("今は 当然");
  });
});

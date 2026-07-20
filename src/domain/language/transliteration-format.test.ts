import { validateTransliterationAlignment } from "@/domain/language/transliteration-format";
import { describe, expect, it } from "vitest";

describe("transliteration alignment validation", () => {
  it("counts lexical source words even when one timing slot contains the entire line", () => {
    expect(
      validateTransliterationAlignment("걸음은 Like a dance", "geol-eum-eun Like a dance", [
        { text: "걸음은 Like a dance", begin: 0, end: 2 },
      ]),
    ).toBeNull();
  });

  it("still reports actual source-word boundary mismatches", () => {
    expect(validateTransliterationAlignment("걸음은 Like", "geol-eum-eunLike")).toContain(
      "Expected 2 word groups, found 1",
    );
  });
});

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

  it("does not treat a syllable-group ID change as a new transliteration word", () => {
    expect(
      validateTransliterationAlignment("風|は|ま|だ|ま|だ|強|い", "kaze-wa-ma-da-ma-da-tsuyo-i", [
        { text: "風", begin: 0, end: 0.1, syllableGroupId: "first" },
        { text: "は", begin: 0.1, end: 0.2, syllableGroupId: "first" },
        { text: "ま", begin: 0.2, end: 0.3, syllableGroupId: "first" },
        { text: "だ", begin: 0.3, end: 0.4, syllableGroupId: "first" },
        { text: "ま", begin: 0.4, end: 0.5, syllableGroupId: "second" },
        { text: "だ", begin: 0.5, end: 0.6, syllableGroupId: "second" },
        { text: "強", begin: 0.6, end: 0.7, syllableGroupId: "second" },
        { text: "い", begin: 0.7, end: 0.8, syllableGroupId: "second" },
      ]),
    ).toBeNull();
  });

  it("regression: validates the imported project line that previously crashed the Languages tab", () => {
    const words = [
      "今",
      "は",
      "当",
      "た",
      "り",
      "前",
      "な",
      "ん",
      "て",
      "思",
      "わ",
      "ない ",
      "風",
      "は",
      "ま",
      "だ",
      "ま",
      "だ",
      "強",
      "い",
    ].map((text, index) => ({
      text,
      begin: index,
      end: index + 1,
      syllableGroupId: index < 12 ? "first" : index < 16 ? "second" : "third",
    }));

    expect(
      validateTransliterationAlignment(
        "今|は|当|た|り|前|な|ん|て|思|わ|ない 風|は|ま|だ|ま|だ|強|い",
        "Ima-wa-tō-ta-ri-zen-na-n-te-Shitau-wa-nai kaze-wa-ma-da|ma|da|tsuyo|i",
        words,
      ),
    ).toContain("Word 2 has 8 timed syllables");
  });

  it("returns a validation error instead of crashing when timing boundaries outnumber transliteration groups", () => {
    expect(
      validateTransliterationAlignment("風 強", "kaze tsuyoi", [
        { text: "風 ", begin: 0, end: 0.2, syllableGroupId: "first" },
        { text: "強 ", begin: 0.2, end: 0.4, syllableGroupId: "second" },
        { text: "い", begin: 0.4, end: 0.6, syllableGroupId: "third" },
        { text: "う", begin: 0.6, end: 0.8, syllableGroupId: "third" },
      ]),
    ).toContain("Timed word boundaries do not align");
  });
});

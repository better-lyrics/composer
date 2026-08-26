import { describe, expect, it } from "vitest";
import { SICKO_MODE_WRITERS } from "@/test/qrc-fixtures";
import {
  creditExtraKey,
  creditValue,
  decodeCredits,
  isCreditLine,
  isQrcTitleLine,
  parseHeaderTags,
  readSingerMarker,
} from "@/utils/lyrics-parsers/qrc-metadata";

// -- Constants ----------------------------------------------------------------

const WANDERLUST_TAGS = { title: "Wanderlust", artists: ["The Weeknd"] };

// -- Tests --------------------------------------------------------------------

describe("parseHeaderTags", () => {
  it("maps ti, ar and al to title, artists and album", () => {
    const tags = parseHeaderTags("[ti:Wanderlust]\r\n[ar:The Weeknd]\r\n[al:Kiss Land]\r\n[offset:0]");
    expect(tags.metadata.title).toBe("Wanderlust");
    expect(tags.metadata.artists).toEqual(["The Weeknd"]);
    expect(tags.metadata.album).toBe("Kiss Land");
  });

  it("records a by tag as the QRC transcriber", () => {
    expect(parseHeaderTags("[by:Kugou User]").metadata.extra).toEqual({ qrcTranscriber: "Kugou User" });
  });

  it("reads offset in milliseconds", () => {
    expect(parseHeaderTags("[offset:250]").offsetSeconds).toBe(0.25);
    expect(parseHeaderTags("[offset:-250]").offsetSeconds).toBe(-0.25);
    expect(parseHeaderTags("[offset:0]").offsetSeconds).toBe(0);
  });

  describe("edge cases", () => {
    it("defaults offset to zero when the tag is absent or unparseable", () => {
      expect(parseHeaderTags("[ti:Song]").offsetSeconds).toBe(0);
      expect(parseHeaderTags("[offset:abc]").offsetSeconds).toBe(0);
      expect(parseHeaderTags("[offset:]").offsetSeconds).toBe(0);
    });

    it("ignores an empty by tag", () => {
      expect(parseHeaderTags("[by:]").metadata.extra).toBeUndefined();
    });

    it("ignores a tag whose value is only whitespace", () => {
      const tags = parseHeaderTags("[ti:   ]\n[ar:\t]\n[al: ]");
      expect(tags.metadata).toEqual({});
    });

    it("reads a tag whatever its case", () => {
      const tags = parseHeaderTags("[TI:Wanderlust]\n[Ar:The Weeknd]\n[OFFSET:250]");
      expect(tags.metadata.title).toBe("Wanderlust");
      expect(tags.metadata.artists).toEqual(["The Weeknd"]);
      expect(tags.offsetSeconds).toBe(0.25);
    });

    it("keeps the last value when a tag repeats", () => {
      expect(parseHeaderTags("[ti:First]\n[ti:Second]").metadata.title).toBe("Second");
    });

    it("trims surrounding whitespace from a value", () => {
      expect(parseHeaderTags("[ti:  Wanderlust  ]").metadata.title).toBe("Wanderlust");
    });

    it("ignores a tag it does not know", () => {
      expect(parseHeaderTags("[kana:わんだ]").metadata).toEqual({});
    });
  });

  describe("invariants", () => {
    it("never returns an empty extra object", () => {
      expect(parseHeaderTags("[ti:Song]").metadata.extra).toBeUndefined();
    });

    it("does not mistake a line header for a metadata tag", () => {
      const tags = parseHeaderTags("[34059,2299]Is (34059,130)it (34189,120)");
      expect(tags.metadata).toEqual({});
      expect(tags.offsetSeconds).toBe(0);
    });

    it("shares no state between calls", () => {
      const first = parseHeaderTags("[ti:One]");
      const second = parseHeaderTags("[ar:Two]");
      expect(first.metadata.artists).toBeUndefined();
      expect(second.metadata.title).toBeUndefined();
    });
  });

  describe("error paths", () => {
    it("returns empty metadata for an empty document", () => {
      const tags = parseHeaderTags("");
      expect(tags.metadata).toEqual({});
      expect(tags.offsetSeconds).toBe(0);
    });

    it("ignores an unterminated tag", () => {
      expect(parseHeaderTags("[ti:Wanderlust").metadata).toEqual({});
    });
  });
});

describe("isCreditLine", () => {
  it("matches English credit prefixes", () => {
    expect(isCreditLine("Lyrics by：QUENNEVILLE/JASON")).toBe(true);
    expect(isCreditLine("Composed by：QUENNEVILLE/JASON")).toBe(true);
  });

  it("matches Chinese credit prefixes", () => {
    expect(isCreditLine("作词 : 方文山")).toBe(true);
    expect(isCreditLine("作曲：周杰倫")).toBe(true);
  });

  it("matches the English agent-noun prefixes QQ uses instead of an X by form", () => {
    expect(isCreditLine("Lyricist：Jacques Webster")).toBe(true);
    expect(isCreditLine("Composer：Jacques Webster")).toBe(true);
    expect(isCreditLine("Arranger：Mike Dean")).toBe(true);
    expect(isCreditLine("Producer：Quincy Jones")).toBe(true);
  });

  describe("edge cases", () => {
    it("matches the remaining English prefixes", () => {
      expect(isCreditLine("Arranged by：X")).toBe(true);
      expect(isCreditLine("Produced by：X")).toBe(true);
      expect(isCreditLine("Written by：X")).toBe(true);
    });

    it("matches the remaining Chinese prefixes", () => {
      expect(isCreditLine("编曲：X")).toBe(true);
      expect(isCreditLine("編曲：X")).toBe(true);
      expect(isCreditLine("制作人：X")).toBe(true);
      expect(isCreditLine("製作人：X")).toBe(true);
    });

    it("matches an ASCII colon", () => {
      expect(isCreditLine("Lyrics by: QUENNEVILLE")).toBe(true);
    });

    it("matches whatever the case", () => {
      expect(isCreditLine("LYRICS BY：QUENNEVILLE")).toBe(true);
    });

    it("tolerates surrounding whitespace", () => {
      expect(isCreditLine("  Composed by ：X  ")).toBe(true);
    });

    it("matches an agent-noun prefix whatever the case or the colon", () => {
      expect(isCreditLine("lyricist: Jacques Webster")).toBe(true);
      expect(isCreditLine("  PRODUCER ：Quincy Jones  ")).toBe(true);
    });
  });

  describe("error paths", () => {
    it("does not match a lyric that merely contains the word by", () => {
      expect(isCreditLine("Stand by me")).toBe(false);
    });

    it("does not match a credit word with no colon after it", () => {
      expect(isCreditLine("Written by the stars")).toBe(false);
    });

    it("does not match a prefix that is not at the start", () => {
      expect(isCreditLine("Song lyrics by：X")).toBe(false);
    });

    it("does not match an agent noun with no colon after it", () => {
      expect(isCreditLine("Producer of the year")).toBe(false);
      expect(isCreditLine("Composer unknown")).toBe(false);
    });

    it("does not match an agent-noun prefix that is not at the start", () => {
      expect(isCreditLine("Executive producer：X")).toBe(false);
    });

    it("does not match an empty line", () => {
      expect(isCreditLine("")).toBe(false);
      expect(isCreditLine("   ")).toBe(false);
    });
  });
});

describe("creditExtraKey", () => {
  it("derives a key from an English prefix", () => {
    expect(creditExtraKey("Lyrics by：X")).toBe("qrcLyricsBy");
    expect(creditExtraKey("Composed by：X")).toBe("qrcComposedBy");
    expect(creditExtraKey("Arranged by：X")).toBe("qrcArrangedBy");
    expect(creditExtraKey("Produced by：X")).toBe("qrcProducedBy");
    expect(creditExtraKey("Written by：X")).toBe("qrcWrittenBy");
  });

  it("derives a key from a Chinese prefix", () => {
    expect(creditExtraKey("作词：方文山")).toBe("qrcLyricist");
    expect(creditExtraKey("作曲：周杰倫")).toBe("qrcComposer");
    expect(creditExtraKey("编曲：X")).toBe("qrcArranger");
    expect(creditExtraKey("編曲：X")).toBe("qrcArranger");
    expect(creditExtraKey("制作人：X")).toBe("qrcProducer");
    expect(creditExtraKey("製作人：X")).toBe("qrcProducer");
  });

  it("derives a key from an English agent-noun prefix", () => {
    expect(creditExtraKey("Lyricist：X")).toBe("qrcLyricsBy");
    expect(creditExtraKey("Composer：X")).toBe("qrcComposedBy");
    expect(creditExtraKey("Arranger：X")).toBe("qrcArrangedBy");
    expect(creditExtraKey("Producer：X")).toBe("qrcProducedBy");
  });

  describe("edge cases", () => {
    it("derives the same key whatever the case", () => {
      expect(creditExtraKey("LYRICS BY：X")).toBe("qrcLyricsBy");
    });

    it("files an agent noun and its by form under one key", () => {
      expect(creditExtraKey("Composer：X")).toBe(creditExtraKey("Composed by：X"));
      expect(creditExtraKey("Lyricist：X")).toBe(creditExtraKey("Lyrics by：X"));
      expect(creditExtraKey("Arranger：X")).toBe(creditExtraKey("Arranged by：X"));
      expect(creditExtraKey("Producer：X")).toBe(creditExtraKey("Produced by：X"));
    });

    it("falls back to a generic key rather than losing the credit", () => {
      expect(creditExtraKey("Nothing here")).toBe("qrcCredits");
    });
  });
});

describe("creditValue", () => {
  it("reads everything after the first colon", () => {
    expect(creditValue("Lyrics by：TESFAYE/ABEL")).toBe("TESFAYE/ABEL");
  });

  describe("edge cases", () => {
    it("reads a Chinese credit value", () => {
      expect(creditValue("作词：方文山")).toBe("方文山");
    });

    it("keeps a colon that appears inside the value", () => {
      expect(creditValue("Lyrics by：A/B：C")).toBe("A/B：C");
    });
  });

  describe("error paths", () => {
    it("returns an empty string when nothing follows the colon", () => {
      expect(creditValue("Lyrics by：")).toBe("");
    });

    it("returns an empty string when the line has no colon", () => {
      expect(creditValue("Lyrics by")).toBe("");
    });
  });
});

describe("decodeCredits", () => {
  it("pairs surname and given name into a readable full name", () => {
    expect(decodeCredits("TESFAYE/ABEL/BALSHE/AHMAD")).toEqual(["Abel Tesfaye", "Ahmad Balshe"]);
  });

  it("keeps multi-part given names intact", () => {
    expect(decodeCredits("QUENNEVILLE/JASON MATTHEW")).toEqual(["Jason Matthew Quenneville"]);
  });

  it("tolerates stray whitespace around slashes", () => {
    expect(decodeCredits("BALSHE/ AHMAD")).toEqual(["Ahmad Balshe"]);
  });

  it("keeps a mixed-case list of complete names as separate people", () => {
    expect(decodeCredits("Jacques Webster/Kanye West/Dez Wright/Samuel Gloade")).toEqual([
      "Jacques Webster",
      "Kanye West",
      "Dez Wright",
      "Samuel Gloade",
    ]);
  });

  it("keeps the capitals inside a name it was given", () => {
    expect(decodeCredits("BryTavious Chambers/Paul McCartney")).toEqual(["BryTavious Chambers", "Paul McCartney"]);
    expect(decodeCredits("Dolores O'Riordan/Dennis DeYoung")).toEqual(["Dolores O'Riordan", "Dennis DeYoung"]);
  });

  it("leaves an all-caps stage name alone in a list that is not in the all-caps convention", () => {
    expect(decodeCredits("SZA/Doja Cat")).toEqual(["SZA", "Doja Cat"]);
    expect(decodeCredits("Travis Scott/MIKE DEAN")).toEqual(["Travis Scott", "MIKE DEAN"]);
  });

  describe("edge cases", () => {
    it("falls back to a plain split when the token count is odd", () => {
      expect(decodeCredits("TESFAYE/ABEL/SOLO")).toEqual(["Tesfaye", "Abel", "Solo"]);
    });

    it("returns an empty list for empty input", () => {
      expect(decodeCredits("")).toEqual([]);
      expect(decodeCredits("   ")).toEqual([]);
    });

    it("drops empty tokens from trailing or doubled slashes", () => {
      expect(decodeCredits("TESFAYE/ABEL/")).toEqual(["Abel Tesfaye"]);
      expect(decodeCredits("TESFAYE//ABEL")).toEqual(["Abel Tesfaye"]);
    });

    it("leaves CJK names untouched by title casing", () => {
      expect(decodeCredits("周杰倫")).toEqual(["周杰倫"]);
    });

    it("treats slash-separated CJK tokens as separate people", () => {
      expect(decodeCredits("周杰倫/方文山")).toEqual(["周杰倫", "方文山"]);
      expect(decodeCredits("方文山/黄俊郎/周杰倫/林迈可")).toEqual(["方文山", "黄俊郎", "周杰倫", "林迈可"]);
    });

    it("keeps mixed-script tokens separate rather than guessing a convention", () => {
      expect(decodeCredits("周杰倫/JASON")).toEqual(["周杰倫", "Jason"]);
    });

    it("title cases an initial without swallowing it", () => {
      expect(decodeCredits("TAMAELA/ALBERT C J BERTH")).toEqual(["Albert C J Berth Tamaela"]);
    });

    it("returns a single token unchanged apart from casing", () => {
      expect(decodeCredits("PRINCE")).toEqual(["Prince"]);
    });

    it("does not pair an even list that mixes an all-caps token with a mixed-case one", () => {
      expect(decodeCredits("PinkPantheress/RISC")).toEqual(["PinkPantheress", "RISC"]);
      expect(decodeCredits("Meltt/Kieran Wagstaff")).toEqual(["Meltt", "Kieran Wagstaff"]);
    });

    it("cannot recover the capitals inside a token once the all-caps convention is in force", () => {
      expect(decodeCredits("MCCARTNEY/PAUL")).toEqual(["Paul Mccartney"]);
      expect(decodeCredits("MCCARTNEY/PAUL/LENNON/JOHN")).toEqual(["Paul Mccartney", "John Lennon"]);
    });
  });

  describe("invariants", () => {
    it("never returns an empty or whitespace-only name", () => {
      for (const name of decodeCredits("TESFAYE/ABEL//BALSHE/ /AHMAD")) {
        expect(name.trim().length).toBeGreaterThan(0);
      }
    });

    it("returns the same result for the same input", () => {
      expect(decodeCredits("TESFAYE/ABEL")).toEqual(decodeCredits("TESFAYE/ABEL"));
    });

    it("halves an even list only when every token is all caps", () => {
      const allCaps = "TESFAYE/ABEL/BALSHE/AHMAD";
      const completeNames = "Mark Knopfler/Neil Dorfsman/Travis Scott/Dez Wright";
      expect(decodeCredits(allCaps)).toHaveLength(allCaps.split("/").length / 2);
      expect(decodeCredits(completeNames)).toHaveLength(completeNames.split("/").length);
    });
  });

  describe("regressions", () => {
    it("regression: does not fold a real QQ credit list of complete names into invented people", () => {
      expect(decodeCredits("Mark Knopfler/Neil Dorfsman")).toEqual(["Mark Knopfler", "Neil Dorfsman"]);
    });

    it("regression: credits every writer QQ lists for SICKO MODE", () => {
      expect(decodeCredits(SICKO_MODE_WRITERS.join("/"))).toEqual(SICKO_MODE_WRITERS);
    });
  });
});

describe("isQrcTitleLine", () => {
  it("matches the title line QQ builds from the header tags", () => {
    expect(isQrcTitleLine("Wanderlust - The Weeknd", WANDERLUST_TAGS)).toBe(true);
  });

  describe("edge cases", () => {
    it("ignores case and whitespace", () => {
      expect(isQrcTitleLine("  wanderlust  -   the weeknd ", WANDERLUST_TAGS)).toBe(true);
    });

    it("ignores whitespace missing around the separator", () => {
      expect(isQrcTitleLine("Wanderlust -The Weeknd", WANDERLUST_TAGS)).toBe(true);
    });

    it("matches a CJK title line whose words carry no spaces", () => {
      expect(isQrcTitleLine("青花瓷-周杰倫", { title: "青花瓷", artists: ["周杰倫"] })).toBe(true);
    });

    it("matches only the first artist", () => {
      const tags = { title: "Wanderlust", artists: ["The Weeknd", "Belly"] };
      expect(isQrcTitleLine("Wanderlust - The Weeknd", tags)).toBe(true);
      expect(isQrcTitleLine("Wanderlust - Belly", tags)).toBe(false);
    });
  });

  describe("error paths", () => {
    it("never eats a lyric that merely contains a hyphen", () => {
      expect(isQrcTitleLine("Half - hearted love", WANDERLUST_TAGS)).toBe(false);
    });

    it("does not match the title or the artist on their own", () => {
      expect(isQrcTitleLine("Wanderlust", WANDERLUST_TAGS)).toBe(false);
      expect(isQrcTitleLine("The Weeknd", WANDERLUST_TAGS)).toBe(false);
    });

    it("matches nothing when a header tag is missing", () => {
      expect(isQrcTitleLine("Wanderlust - The Weeknd", { title: "Wanderlust" })).toBe(false);
      expect(isQrcTitleLine("Wanderlust - The Weeknd", { artists: ["The Weeknd"] })).toBe(false);
      expect(isQrcTitleLine("Wanderlust - The Weeknd", {})).toBe(false);
      expect(isQrcTitleLine(" - ", { title: "", artists: [""] })).toBe(false);
    });
  });
});

describe("readSingerMarker", () => {
  it("reads a name from a fullwidth-colon marker", () => {
    expect(readSingerMarker("The Weeknd：")).toEqual(["The Weeknd"]);
    expect(readSingerMarker("Fox the Fox：")).toEqual(["Fox the Fox"]);
  });

  it("reads a name from an ASCII-colon marker", () => {
    expect(readSingerMarker("The Weeknd:")).toEqual(["The Weeknd"]);
  });

  it("reads every performer a slash-separated marker names", () => {
    expect(readSingerMarker("Drake/Travis Scott：")).toEqual(["Drake", "Travis Scott"]);
    expect(readSingerMarker("Big Hawk/Swae Lee/Travis Scott：")).toEqual(["Big Hawk", "Swae Lee", "Travis Scott"]);
  });

  it("keeps a period a performer name carries, inside it or at its end", () => {
    expect(readSingerMarker("will.i.am：")).toEqual(["will.i.am"]);
    expect(readSingerMarker("Ph.D：")).toEqual(["Ph.D"]);
    expect(readSingerMarker("Wait.：")).toEqual(["Wait."]);
  });

  describe("edge cases", () => {
    it("rejects a lyric that ends in a colon but reads as a sentence", () => {
      expect(readSingerMarker("And then she said, listen to me:")).toBeNull();
    });

    it("rejects a long trailing-colon line", () => {
      expect(readSingerMarker(`${"a".repeat(41)}：`)).toBeNull();
    });

    it("accepts a name right on the length bound", () => {
      expect(readSingerMarker(`${"a".repeat(40)}：`)).toEqual(["a".repeat(40)]);
    });

    it("bounds the length of each performer rather than of the marker", () => {
      const two = `${"a".repeat(40)}/${"b".repeat(40)}`;
      expect(readSingerMarker(`${two}：`)).toEqual(["a".repeat(40), "b".repeat(40)]);
      expect(readSingerMarker(`Drake/${"a".repeat(41)}：`)).toBeNull();
    });

    it("bounds how many performers one marker may name", () => {
      const eight = Array.from({ length: 8 }, (_, index) => `P${index}`);
      expect(readSingerMarker(`${eight.join("/")}：`)).toEqual(eight);
      expect(readSingerMarker(`${[...eight, "P8"].join("/")}：`)).toBeNull();
    });

    it("names a performer once however often one marker repeats them", () => {
      expect(readSingerMarker("Drake/Drake：")).toEqual(["Drake"]);
      expect(readSingerMarker("Drake/DRAKE：")).toEqual(["Drake"]);
      expect(readSingerMarker("Drake/Travis Scott/Drake：")).toEqual(["Drake", "Travis Scott"]);
    });

    it("rejects a bare colon", () => {
      expect(readSingerMarker("：")).toBeNull();
      expect(readSingerMarker("  ：")).toBeNull();
    });

    it("rejects a marker whose slashes name nobody", () => {
      expect(readSingerMarker("/：")).toBeNull();
      expect(readSingerMarker("///：")).toBeNull();
      expect(readSingerMarker(" / ：")).toBeNull();
    });

    it("rejects a line that does not end in a colon", () => {
      expect(readSingerMarker("The Weeknd")).toBeNull();
      expect(readSingerMarker("Lyrics by：QUENNEVILLE")).toBeNull();
    });

    it("rejects a name that carries a second colon", () => {
      expect(readSingerMarker("Verse 1：The Weeknd：")).toBeNull();
      expect(readSingerMarker("Drake/Verse 1：Travis Scott：")).toBeNull();
    });

    it("rejects every flavour of sentence punctuation the period aside", () => {
      for (const name of ["Wait,", "Wait!", "Wait?", "Wait;", "等。", "等，", "等！", "等？"]) {
        expect(readSingerMarker(`${name}：`)).toBeNull();
      }
    });

    it("accepts a short CJK performer name", () => {
      expect(readSingerMarker("周杰倫：")).toEqual(["周杰倫"]);
      expect(readSingerMarker("周杰倫/方文山：")).toEqual(["周杰倫", "方文山"]);
    });

    it("trims whitespace around the marker and around each performer", () => {
      expect(readSingerMarker("  The Weeknd  ：  ")).toEqual(["The Weeknd"]);
      expect(readSingerMarker("  Drake /  Travis Scott ：")).toEqual(["Drake", "Travis Scott"]);
    });

    it("drops empty performers from doubled or trailing slashes", () => {
      expect(readSingerMarker("Drake//Travis Scott：")).toEqual(["Drake", "Travis Scott"]);
      expect(readSingerMarker("Drake/：")).toEqual(["Drake"]);
    });
  });

  describe("invariants", () => {
    it("never returns an empty or whitespace-only performer name", () => {
      const performers = readSingerMarker("Drake/ /Travis Scott//Swae Lee：");
      expect(performers).toHaveLength(3);
      for (const performer of performers ?? []) {
        expect(performer.trim().length).toBeGreaterThan(0);
      }
    });

    it("returns a fresh array the caller may keep", () => {
      const first = readSingerMarker("Drake/Travis Scott：");
      const second = readSingerMarker("Drake/Travis Scott：");
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
    });
  });

  describe("regressions", () => {
    it("regression: reads the SICKO MODE marker whose performer name is an initialism", () => {
      expect(readSingerMarker("Travis Scott/The Notorious B.I.G.：")).toEqual(["Travis Scott", "The Notorious B.I.G."]);
    });

    it("regression: refuses to read a slash-heavy line as a fifty-strong group", () => {
      const many = Array.from({ length: 50 }, (_, index) => `P${index}`).join("/");
      expect(readSingerMarker(`${many}：`)).toBeNull();
    });
  });

  describe("error paths", () => {
    it("rejects an empty line", () => {
      expect(readSingerMarker("")).toBeNull();
      expect(readSingerMarker("   ")).toBeNull();
    });
  });
});

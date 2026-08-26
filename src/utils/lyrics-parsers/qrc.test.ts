import { describe, expect, it } from "vitest";
import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import type { LyricLine } from "@/domain/line/model";
import { reconstructLineText } from "@/domain/line/reconstruct-text";
import { useSettingsStore } from "@/stores/settings";
import { SICKO_MODE_QRC, SICKO_MODE_WRITERS, WANDERLUST_QRC } from "@/test/qrc-fixtures";
import { parseQrc } from "@/utils/lyrics-parsers/qrc";
import { getSplitCharacter } from "@/utils/split-character";

// -- Constants ----------------------------------------------------------------

const FIRST_LYRIC_TEXT = "Is it so hard to say the same thing";
// One credit list QQ wrapped across two lines, with the wrap between BALSHE and AHMAD.
const WRAPPED_MID_PAIR_QRC =
  "[1000,500]Lyrics by：(1000,250)TESFAYE/ABEL/BALSHE(1250,250)\n[2000,500]Lyrics by：(2000,250)AHMAD(2250,250)";
const CHINESE_CREDIT_PREFIXES = [
  ["作词", "qrcLyricist"],
  ["作曲", "qrcComposer"],
  ["编曲", "qrcArranger"],
  ["編曲", "qrcArranger"],
  ["制作人", "qrcProducer"],
  ["製作人", "qrcProducer"],
] as const;

// -- Helpers ------------------------------------------------------------------

function withoutLineId(line: LyricLine): Omit<LyricLine, "id"> {
  const { id, ...rest } = line;
  return rest;
}

// Mirrors how QQ tags CJK: one word tag per character, so the reconstructed text
// carries a split character at every joint.
function perCharacterQrcLine(beginMs: number, text: string): string {
  const characters = [...text];
  const body = characters.map((character, index) => `${character}(${beginMs + index * 100},100)`).join("");
  return `[${beginMs},${characters.length * 100}]${body}`;
}

// -- Tests --------------------------------------------------------------------

describe("parseQrc", () => {
  describe("lines and words", () => {
    it("parses exactly the real lyric lines from a real QRC document", () => {
      const result = parseQrc(WANDERLUST_QRC);
      expect(result.lines).toHaveLength(84);
      expect(result.hasTimingData).toBe(true);
    });

    it("reads word timing that trails the word it belongs to", () => {
      const result = parseQrc(WANDERLUST_QRC);
      const first = result.lines.find((line) => line.text === FIRST_LYRIC_TEXT);
      expect(first).toBeDefined();
      expect(first?.words?.[0]).toEqual({ text: "Is ", begin: 34.059, end: 34.189 });
      expect(first?.words?.[1]).toEqual({ text: "it ", begin: 34.189, end: 34.309 });
      expect(first?.words?.at(-1)).toEqual({ text: "thing", begin: 35.42, end: 36.358 });
    });

    it("converts milliseconds to seconds", () => {
      const result = parseQrc("[34059,2299]Is (34059,130)it (34189,120)");
      expect(result.lines[0].words?.[0].begin).toBe(34.059);
      expect(result.lines[0].words?.[0].end).toBe(34.189);
    });

    it("preserves trailing spaces as word separators", () => {
      const result = parseQrc(WANDERLUST_QRC);
      const first = result.lines.find((line) => line.text === FIRST_LYRIC_TEXT);
      const words = first?.words ?? [];
      expect(words.map((word) => word.text).join("")).toBe(FIRST_LYRIC_TEXT);
    });

    it("parses a document whose body is not wrapped in QrcInfos XML", () => {
      const result = parseQrc("[34059,2299]Is (34059,130)it (34189,2170)");
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].words).toHaveLength(2);
    });
  });

  describe("metadata", () => {
    it("lifts header tags into project metadata", () => {
      const result = parseQrc(WANDERLUST_QRC);
      expect(result.metadata.title).toBe("Wanderlust");
      expect(result.metadata.artists).toEqual(["The Weeknd"]);
      expect(result.metadata.album).toBe("Kiss Land");
    });

    it("does not mistake a line header for a metadata tag", () => {
      const result = parseQrc("[34059,2299]Is (34059,2299)");
      expect(result.metadata.title).toBeUndefined();
    });

    it("shifts line and word timing by the header offset", () => {
      const result = parseQrc("[offset:1000]\n[34059,2299]Is (34059,130)it (34189,2170)");
      expect(result.lines[0].words?.[0].begin).toBeCloseTo(35.059, 9);
      expect(result.lines[0].words?.[0].end).toBeCloseTo(35.189, 9);
      expect(result.lines[0].words?.[1].end).toBeCloseTo(37.359, 9);
    });

    it("shifts a line-synced line by the header offset", () => {
      const result = parseQrc("[offset:1000]\n[1000,2500]No word tags here");
      expect(result.lines[0].begin).toBe(2);
      expect(result.lines[0].end).toBe(4.5);
    });

    it("clamps a negative offset so no time drops below zero", () => {
      const result = parseQrc("[offset:-60000]\n[34059,2299]Is (34059,130)it (34189,2170)");
      expect(result.lines[0].words?.[0].begin).toBe(0);
      expect(result.lines[0].words?.[0].end).toBe(0);
    });

    it("leaves timing untouched when the offset is zero", () => {
      const result = parseQrc("[offset:0]\n[34059,2299]Is (34059,130)it (34189,2170)");
      expect(result.lines[0].words?.[0].begin).toBe(34.059);
      expect(result.lines[0].words?.[0].end).toBe(34.189);
    });
  });

  describe("credits", () => {
    it("decodes the credits block into songwriters", () => {
      const result = parseQrc(WANDERLUST_QRC);
      expect(result.metadata.songwriters).toEqual([
        "Jason Matthew Quenneville",
        "Danny Schofield",
        "Abel Tesfaye",
        "Ahmad Balshe",
        "Joseph Brady Bostani",
        "Selfia Musmin",
        "Albert C J Berth Tamaela",
      ]);
    });

    it("keeps the raw credit strings in metadata extra", () => {
      const result = parseQrc(WANDERLUST_QRC);
      expect(result.metadata.extra?.qrcLyricsBy).toContain("QUENNEVILLE/JASON MATTHEW");
      expect(result.metadata.extra?.qrcComposedBy).toContain("QUENNEVILLE/JASON MATTHEW");
    });

    it("dedupes writers credited on both the lyrics and composed lines", () => {
      const result = parseQrc(WANDERLUST_QRC);
      const unique = new Set(result.metadata.songwriters);
      expect(unique.size).toBe(result.metadata.songwriters?.length);
    });

    it("drops the credits block and the title line from the lyrics", () => {
      const result = parseQrc(WANDERLUST_QRC);
      const texts = result.lines.map((line) => line.text);
      expect(texts.some((text) => text.startsWith("Lyrics by"))).toBe(false);
      expect(texts.some((text) => text.startsWith("Composed by"))).toBe(false);
      expect(texts).not.toContain("Wanderlust - The Weeknd");
    });

    it("merges header-tag extras with credit extras", () => {
      const result = parseQrc("[by:Kugou User]\n[1000,500]Lyrics by：(1000,250)TESFAYE/ABEL(1250,250)");
      expect(result.metadata.extra).toEqual({ qrcTranscriber: "Kugou User", qrcLyricsBy: "TESFAYE/ABEL" });
      expect(result.metadata.songwriters).toEqual(["Abel Tesfaye"]);
    });

    it("keeps a hyphenated lyric that is not the title line", () => {
      const result = parseQrc("[ti:Wanderlust]\n[ar:The Weeknd]\n[1000,500]Half (1000,250)- hearted(1250,250)");
      expect(result.lines.map((line) => line.text)).toEqual(["Half - hearted"]);
    });

    it("keeps a lyric that merely contains the word by", () => {
      const result = parseQrc("[1000,500]Stand (1000,250)by me(1250,250)");
      expect(result.lines.map((line) => line.text)).toEqual(["Stand by me"]);
    });

    it("detects a Chinese credit line QQ tagged one character at a time", () => {
      const result = parseQrc("[1000,500]作(1000,150)词(1150,150)：(1300,200)方文山(1500,100)\n[2000,500]歌(2000,500)");
      expect(result.lines.map((line) => line.text)).toEqual(["歌"]);
      expect(result.metadata.songwriters).toEqual(["方文山"]);
      expect(result.metadata.extra?.qrcLyricist).toBe("方文山");
    });

    it("detects every Chinese credit prefix QQ tags one character at a time", () => {
      for (const [prefix, extraKey] of CHINESE_CREDIT_PREFIXES) {
        const result = parseQrc(perCharacterQrcLine(1000, `${prefix}：方文山`));
        expect(result.lines).toEqual([]);
        expect(result.metadata.extra?.[extraKey]).toBe("方文山");
        expect(result.metadata.songwriters).toEqual(["方文山"]);
      }
    });

    it("credits each CJK songwriter separately", () => {
      const result = parseQrc(perCharacterQrcLine(1000, "作词：方文山/黄俊郎"));
      expect(result.metadata.songwriters).toEqual(["方文山", "黄俊郎"]);
    });

    it("drops a title line QQ tagged one character at a time", () => {
      const result = parseQrc(
        `[ti:青花瓷]\n[ar:周杰倫]\n${perCharacterQrcLine(1000, "青花瓷 - 周杰倫")}\n[9000,500]歌(9000,500)`,
      );
      expect(result.lines.map((line) => line.text)).toEqual(["歌"]);
    });

    it("keeps both halves of a credit list QQ wrapped across two lines", () => {
      const result = parseQrc(
        "[1000,500]Lyrics by：(1000,250)TESFAYE/ABEL(1250,250)\n[2000,500]Lyrics by：(2000,250)BALSHE/AHMAD(2250,250)",
      );
      expect(result.metadata.extra?.qrcLyricsBy).toBe("TESFAYE/ABEL/BALSHE/AHMAD");
      expect(result.metadata.songwriters).toEqual(["Abel Tesfaye", "Ahmad Balshe"]);
    });

    it("reads a credit line whose prefix is an agent noun rather than an X by form", () => {
      const result = parseQrc(SICKO_MODE_QRC);
      expect(result.metadata.songwriters).toEqual(SICKO_MODE_WRITERS);
      expect(result.metadata.extra?.qrcLyricsBy).toBe(SICKO_MODE_WRITERS.join("/"));
      expect(result.metadata.extra?.qrcComposedBy).toBe(SICKO_MODE_WRITERS.join("/"));
    });

    it("drops an agent-noun credit line and the title line from the lyrics", () => {
      const result = parseQrc(SICKO_MODE_QRC);
      expect(result.lines.map((line) => line.text)).toEqual(["Astro yeah", "Sun is down freezin' cold"]);
    });

    it("drops a credit line that names nobody without inventing an empty entry", () => {
      const result = parseQrc("[1000,500]Lyrics by：(1000,500)");
      expect(result.lines).toEqual([]);
      expect(result.metadata.extra).toBeUndefined();
      expect(result.metadata.songwriters).toBeUndefined();
      // A credit prefix also reads as a singer marker, so credits must be classified first.
      expect(result.agents).toBeUndefined();
    });

    it("reports no songwriters when the document credits nobody", () => {
      const result = parseQrc("[1000,500]Hi (1000,500)");
      expect(result.metadata.songwriters).toBeUndefined();
      expect(result.metadata.extra).toBeUndefined();
    });

    it("joins an X by line and an agent-noun line that share a key into one credit list", () => {
      const result = parseQrc(
        "[1000,500]Lyrics by：(1000,250)TESFAYE/ABEL(1250,250)\n[2000,500]Lyricist：(2000,250)BALSHE/AHMAD(2250,250)",
      );
      expect(result.metadata.extra?.qrcLyricsBy).toBe("TESFAYE/ABEL/BALSHE/AHMAD");
      expect(result.metadata.songwriters).toEqual(["Abel Tesfaye", "Ahmad Balshe"]);
    });

    it("consumes a bare agent-noun line as an empty credit rather than a singer marker", () => {
      for (const noun of ["Producer", "Composer", "Lyricist", "Arranger"]) {
        const result = parseQrc(`[1000,500]${noun}：(1000,500)`);
        expect(result.agents).toBeUndefined();
        expect(result.lines).toEqual([]);
        expect(result.metadata.extra).toBeUndefined();
      }
    });

    describe("regressions", () => {
      it("regression: decodes a wrapped credit list whose wrap falls between a surname and its given name", () => {
        const result = parseQrc(WRAPPED_MID_PAIR_QRC);
        expect(result.metadata.extra?.qrcLyricsBy).toBe("TESFAYE/ABEL/BALSHE/AHMAD");
        expect(result.metadata.songwriters).toEqual(["Abel Tesfaye", "Ahmad Balshe"]);
      });

      it("regression: reads the songwriters of a wrapped list the same as the unwrapped list", () => {
        const wrapped = parseQrc(WRAPPED_MID_PAIR_QRC);
        const unwrapped = parseQrc("[1000,500]Lyrics by：(1000,250)TESFAYE/ABEL/BALSHE/AHMAD(1250,250)");
        expect(wrapped.metadata.songwriters).toEqual(unwrapped.metadata.songwriters);
        expect(wrapped.metadata.extra).toEqual(unwrapped.metadata.extra);
      });

      it("regression: joins each credit key separately and orders songwriters by key, not by line", () => {
        const result = parseQrc(
          [
            "[1000,500]Lyrics by：(1000,250)TESFAYE/ABEL/BALSHE(1250,250)",
            "[2000,500]Composed by：(2000,250)QUENNEVILLE(2250,250)",
            "[3000,500]Lyrics by：(3000,250)AHMAD(3250,250)",
            "[4000,500]Composed by：(4000,250)JASON(4250,250)",
          ].join("\n"),
        );
        expect(result.metadata.extra?.qrcLyricsBy).toBe("TESFAYE/ABEL/BALSHE/AHMAD");
        expect(result.metadata.extra?.qrcComposedBy).toBe("QUENNEVILLE/JASON");
        // Every name of the first key precedes every name of the second, though the lines interleave.
        expect(result.metadata.songwriters).toEqual(["Abel Tesfaye", "Ahmad Balshe", "Jason Quenneville"]);
      });
    });
  });

  describe("agents", () => {
    it("turns singer markers into agents", () => {
      const result = parseQrc(WANDERLUST_QRC);
      expect(result.agents).toEqual([
        { id: "v1", type: "person", name: "The Weeknd" },
        { id: "v2", type: "person", name: "Fox the Fox" },
      ]);
    });

    it("attributes lines to the singer marked most recently before them", () => {
      const result = parseQrc(WANDERLUST_QRC);
      const foxLines = result.lines.filter((line) => line.agentId === "v2");
      expect(foxLines).toHaveLength(9);
      expect(foxLines[0].text).toBe("Precious little diamond");
    });

    it("drops marker lines from the lyrics", () => {
      const texts = parseQrc(WANDERLUST_QRC).lines.map((line) => line.text);
      expect(texts).not.toContain("The Weeknd：");
      expect(texts).not.toContain("Fox the Fox：");
    });

    it("returns no agents when the document has no singer markers", () => {
      const result = parseQrc("[34059,2299]Is (34059,2299)");
      expect(result.agents).toBeUndefined();
      expect(result.lines[0].agentId).toBe("v1");
    });

    it("gives lines before the first marker the default voice instead of the first singer", () => {
      const result = parseQrc(
        "[1000,500]Intro (1000,500)\n[2000,500]Fox the Fox：(2000,500)\n[3000,500]Verse(3000,500)",
      );
      expect(result.agents).toEqual([
        { id: "v1", type: "person", name: DEFAULT_AGENTS[0].name },
        { id: "v2", type: "person", name: "Fox the Fox" },
      ]);
      expect(result.lines.map((line) => line.agentId)).toEqual(["v1", "v2"]);
    });

    it("names the default voice as the project already names an unnamed one", () => {
      const result = parseQrc(
        "[1000,500]Intro (1000,500)\n[2000,500]Fox the Fox：(2000,500)\n[3000,500]Verse(3000,500)",
      );
      expect(result.agents?.[0]).toEqual(DEFAULT_AGENTS[0]);
      expect(result.agents?.[0]).not.toBe(DEFAULT_AGENTS[0]);
    });

    it("treats markers that differ only in case as one singer", () => {
      const result = parseQrc(
        "[1000,500]The Weeknd：(1000,500)\n[2000,500]One(2000,500)\n[3000,500]THE WEEKND：(3000,500)\n[4000,500]Two(4000,500)",
      );
      expect(result.agents).toEqual([{ id: "v1", type: "person", name: "The Weeknd" }]);
      expect(result.lines.map((line) => line.agentId)).toEqual(["v1", "v1"]);
    });

    it("reads a marker name QQ tagged one character at a time", () => {
      const result = parseQrc("[1000,500]周(1000,150)杰(1150,150)倫(1300,100)：(1400,100)\n[2000,500]歌(2000,500)");
      expect(result.agents).toEqual([{ id: "v1", type: "person", name: "周杰倫" }]);
      expect(result.agents?.[0].name).not.toContain(getSplitCharacter());
      expect(result.lines.map((line) => line.agentId)).toEqual(["v1"]);
    });

    it("reads a marker name whose word tags split a word", () => {
      const result = parseQrc("[1000,500]The (1000,150)Week(1150,150)nd：(1300,200)\n[2000,500]Hi(2000,500)");
      expect(result.agents).toEqual([{ id: "v1", type: "person", name: "The Weeknd" }]);
    });

    it("reuses an agent when a marker repeats instead of minting a new one", () => {
      const result = parseQrc(
        "[1000,500]A：(1000,500)\n[2000,500]One(2000,500)\n[3000,500]B：(3000,500)\n[4000,500]Two(4000,500)\n[5000,500]A：(5000,500)\n[6000,500]Three(6000,500)",
      );
      expect(result.agents).toEqual([
        { id: "v1", type: "person", name: "A" },
        { id: "v2", type: "person", name: "B" },
      ]);
      expect(result.lines.map((line) => line.agentId)).toEqual(["v1", "v2", "v1"]);
    });

    it("does not treat a credit line as a singer marker", () => {
      const result = parseQrc("[1000,500]Lyrics by：(1000,250)TESFAYE/ABEL(1250,250)");
      expect(result.agents).toBeUndefined();
      expect(result.lines).toEqual([]);
      expect(result.metadata.extra?.qrcLyricsBy).toBe("TESFAYE/ABEL");
    });
  });

  describe("edge cases", () => {
    it("joins spaceless CJK syllables with the split character", () => {
      const splitChar = getSplitCharacter();
      const result = parseQrc("[1000,1500]我(1000,500)们(1500,500)走(2000,500)");
      expect(result.lines[0].text).toBe(`我${splitChar}们${splitChar}走`);
      expect(result.lines[0].words?.map((word) => word.text)).toEqual(["我", "们", "走"]);
    });

    it("keeps the trailing space a final word carries", () => {
      const result = parseQrc("[1000,2000]Hello (1000,500)world (1500,500)");
      expect(result.lines[0].text).toBe("Hello world ");
    });

    it("splits lines on CRLF without leaking the separator into a word", () => {
      const result = parseQrc("[1000,500]Hi (1000,250)there(1250,250)\r\n[2000,500]Bye(2000,500)");
      expect(result.lines).toHaveLength(2);
      expect(result.lines[0].words?.at(-1)?.text).toBe("there");
      expect(result.lines[1].words?.map((word) => word.text)).toEqual(["Bye"]);
    });

    it("falls back to line timing when text trails the final word tag", () => {
      const result = parseQrc("[1000,2000]Hello (1000,500)world");
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].text).toBe("Hello world");
      expect(result.lines[0].words).toBeUndefined();
      expect(result.lines[0].begin).toBe(1);
      expect(result.lines[0].end).toBe(3);
    });

    it("drops a header whose body is empty", () => {
      const result = parseQrc("[1000,500]\n[2000,500]Bye(2000,500)");
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].text).toBe("Bye");
    });
  });

  describe("invariants", () => {
    it("line text always equals the reconstruction of its words", () => {
      const result = parseQrc(WANDERLUST_QRC);
      const splitChar = getSplitCharacter();
      for (const line of result.lines) {
        if (!line.words?.length) continue;
        expect(line.text).toBe(reconstructLineText(line.words, splitChar));
      }
    });

    it("never returns a line that is both word-synced and line-synced", () => {
      const result = parseQrc(WANDERLUST_QRC);
      for (const line of result.lines) {
        if (line.words) expect(line.begin).toBeUndefined();
      }
    });

    it("orders every word within a line and never inverts a word's own bounds", () => {
      const result = parseQrc(WANDERLUST_QRC);
      for (const line of result.lines) {
        const words = line.words ?? [];
        for (let i = 0; i < words.length; i++) {
          expect(words[i].end).toBeGreaterThanOrEqual(words[i].begin);
          if (i > 0) expect(words[i].begin).toBeGreaterThanOrEqual(words[i - 1].begin);
        }
      }
    });

    it("parses the same lyrics whatever the split character is set to", () => {
      const baseline = parseQrc(WANDERLUST_QRC);
      const original = useSettingsStore.getState().splitCharacter;
      try {
        for (const splitCharacter of ["/", "-", ":", "・"]) {
          useSettingsStore.setState({ splitCharacter });
          const result = parseQrc(WANDERLUST_QRC);
          expect(result.lines).toHaveLength(baseline.lines.length);
          expect(result.metadata).toEqual(baseline.metadata);
          expect(result.agents).toEqual(baseline.agents);
          expect(result.lines.map((line) => line.words?.map((word) => word.text))).toEqual(
            baseline.lines.map((line) => line.words?.map((word) => word.text)),
          );
        }
      } finally {
        useSettingsStore.setState({ splitCharacter: original });
      }
    });

    it("never leaves a split character in an agent name or a songwriter", () => {
      const splitChar = getSplitCharacter();
      const documents = [
        WANDERLUST_QRC,
        `${perCharacterQrcLine(1000, "作词：方文山")}\n${perCharacterQrcLine(3000, "周杰倫：")}\n[9000,500]歌(9000,500)`,
      ];
      for (const document of documents) {
        const result = parseQrc(document);
        for (const agent of result.agents ?? []) expect(agent.name).not.toContain(splitChar);
        for (const songwriter of result.metadata.songwriters ?? []) expect(songwriter).not.toContain(splitChar);
      }
    });

    it("every line references an agent that exists", () => {
      const result = parseQrc(WANDERLUST_QRC);
      const ids = new Set((result.agents ?? []).map((agent) => agent.id));
      for (const line of result.lines) expect(ids.has(line.agentId)).toBe(true);
    });

    it("is idempotent across repeated parses apart from generated line ids", () => {
      const first = parseQrc(WANDERLUST_QRC);
      const second = parseQrc(WANDERLUST_QRC);
      expect(first.lines.map(withoutLineId)).toEqual(second.lines.map(withoutLineId));
      expect(first.metadata).toEqual(second.metadata);
      expect(first.agents).toEqual(second.agents);
    });

    it("gives every line a unique id", () => {
      const result = parseQrc(WANDERLUST_QRC);
      expect(new Set(result.lines.map((line) => line.id)).size).toBe(result.lines.length);
    });
  });

  describe("error paths", () => {
    it("returns nothing for empty input", () => {
      const result = parseQrc("");
      expect(result.lines).toEqual([]);
      expect(result.hasTimingData).toBe(false);
    });

    it("reads a malformed QrcInfos document as a raw body", () => {
      const result = parseQrc('<QrcInfos><LyricInfo LyricCount="1"></QrcInfos>\n[1000,500]Hi (1000,500)');
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].words?.map((word) => word.text)).toEqual(["Hi "]);
    });

    it("returns nothing when QrcInfos carries no LyricContent attribute", () => {
      const result = parseQrc('<QrcInfos><LyricInfo LyricCount="1"/></QrcInfos>');
      expect(result.lines).toEqual([]);
      expect(result.hasTimingData).toBe(false);
    });

    it("keeps a line with no word tags as line-synced", () => {
      const result = parseQrc("[1000,2500]No word tags here");
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].text).toBe("No word tags here");
      expect(result.lines[0].words).toBeUndefined();
      expect(result.lines[0].begin).toBe(1);
      expect(result.lines[0].end).toBe(3.5);
      expect(result.hasTimingData).toBe(true);
    });

    it("ignores header tags that are not a line header", () => {
      const result = parseQrc("[ti:Wanderlust]\n[offset:0]\n[1000,500]Hi (1000,500)");
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].text).toBe("Hi ");
    });
  });
});

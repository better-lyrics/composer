import { describe, expect, it } from "vitest";
import { type LooseLine, reconcileLine, toFlat } from "@/domain/line/model";
import { isUntimed, isWordSynced } from "@/domain/voice/predicates";
import type { WordTiming } from "@/domain/word/timing";

// -- Fixtures -----------------------------------------------------------------

const mainWords: WordTiming[] = [
  { text: "Hel", begin: 1.25, end: 1.8 },
  { text: "lo", begin: 1.8, end: 2.4 },
];

const bgWords: WordTiming[] = [
  { text: "ah", begin: 6.1, end: 6.9 },
  { text: "oh", begin: 6.9, end: 7.5 },
];

const IDENTITY = { id: "line-7", text: "Hello world", agentId: "v2" } as const;

type MainCase = { name: string; fields: Partial<LooseLine> };
type BgCase = { name: string; fields: Partial<LooseLine> };

const MAIN_CASES: MainCase[] = [
  { name: "untimed", fields: {} },
  { name: "line-synced", fields: { begin: 3.5, end: 8.25 } },
  { name: "word-synced", fields: { words: mainWords } },
];

const BG_CASES: BgCase[] = [
  { name: "none", fields: {} },
  { name: "text-only", fields: { backgroundText: "ooh ah" } },
  { name: "word-synced", fields: { backgroundText: "ah oh", backgroundWords: bgWords } },
];

function loose(extras: Partial<LooseLine> = {}): LooseLine {
  return { ...IDENTITY, ...extras };
}

// -- reconcileLine -> toFlat round-trip ---------------------------------------

describe("reconcileLine -> toFlat round-trip", () => {
  for (const main of MAIN_CASES) {
    for (const bg of BG_CASES) {
      it(`is an identity for main=${main.name} bg=${bg.name}`, () => {
        const input = loose({ ...main.fields, ...bg.fields });
        expect(toFlat(reconcileLine(input))).toEqual(input);
      });
    }
  }
});

// -- idempotence --------------------------------------------------------------

describe("idempotence", () => {
  for (const main of MAIN_CASES) {
    for (const bg of BG_CASES) {
      it(`one extra trip changes nothing for main=${main.name} bg=${bg.name}`, () => {
        const input = loose({ ...main.fields, ...bg.fields });
        const once = reconcileLine(input);
        const twice = reconcileLine(toFlat(once));
        expect(twice).toEqual(once);
      });
    }
  }
});

// -- normalization asymmetry --------------------------------------------------

describe("normalization asymmetry", () => {
  it("word-only background normalizes authored text from undefined to empty string", () => {
    const input = loose({ backgroundWords: bgWords });
    expect(input.backgroundText).toBeUndefined();

    const reconciled = reconcileLine(input);
    expect(reconciled.background).toEqual({ text: "", words: bgWords, source: undefined });
    expect(reconciled.background?.text).toBe("");

    const flat = toFlat(reconciled);
    expect(flat.backgroundText).toBe("");
    expect(flat.backgroundText).not.toBeUndefined();
  });

  it("is idempotent after the first normalization", () => {
    const input = loose({ backgroundWords: bgWords });
    const once = reconcileLine(input);
    const twice = reconcileLine(toFlat(once));
    expect(twice).toEqual(once);
    expect(twice.background).toEqual({ text: "", words: bgWords, source: undefined });
  });
});

// -- invariants ---------------------------------------------------------------

describe("invariants", () => {
  describe("words wins over begin/end", () => {
    it("reconciles a main with both words and begin/end to word-synced with no begin/end", () => {
      const input = loose({ words: mainWords, begin: 0, end: 999 });
      const reconciled = reconcileLine(input);

      expect(isWordSynced(reconciled.main)).toBe(true);
      expect("words" in reconciled.main).toBe(true);
      expect("begin" in reconciled.main).toBe(false);
      expect("end" in reconciled.main).toBe(false);
    });

    it("toFlat emits no begin/end when words won", () => {
      const flat = toFlat(reconcileLine(loose({ words: mainWords, begin: 0, end: 999 })));
      expect(flat.words).toEqual(mainWords);
      expect("begin" in flat).toBe(false);
      expect("end" in flat).toBe(false);
    });
  });

  describe("identity preserved", () => {
    it("survives a round-trip with every identity field set", () => {
      const input: LooseLine = {
        id: "line-99",
        text: "Identity line",
        agentId: "v3",
        groupId: "group-2",
        instanceIdx: 4,
        templateLineIdx: 1,
        detached: true,
        words: mainWords,
      };
      const flat = toFlat(reconcileLine(input));
      expect(flat).toEqual(input);
      expect(flat.groupId).toBe("group-2");
      expect(flat.instanceIdx).toBe(4);
      expect(flat.templateLineIdx).toBe(1);
      expect(flat.detached).toBe(true);
      expect(flat.agentId).toBe("v3");
      expect(flat.id).toBe("line-99");
    });

    it("survives a round-trip with no optional identity fields set", () => {
      const input: LooseLine = { id: "bare", text: "Bare line", agentId: "v1" };
      const reconciled = reconcileLine(input);
      expect("groupId" in reconciled).toBe(false);
      expect("instanceIdx" in reconciled).toBe(false);
      expect("templateLineIdx" in reconciled).toBe(false);
      expect("detached" in reconciled).toBe(false);

      const flat = toFlat(reconciled);
      expect(flat).toEqual(input);
      expect("groupId" in flat).toBe(false);
      expect("instanceIdx" in flat).toBe(false);
      expect("templateLineIdx" in flat).toBe(false);
      expect("detached" in flat).toBe(false);
    });
  });

  describe("provenance preserved", () => {
    it("survives the round-trip for a text-only extraction background", () => {
      const input = loose({ backgroundText: "ooh", backgroundTextSource: "extraction" });
      const flat = toFlat(reconcileLine(input));
      expect(flat.backgroundTextSource).toBe("extraction");
      expect(flat).toEqual(input);
    });

    it("survives the round-trip for a text-only manual background", () => {
      const input = loose({ backgroundText: "ooh", backgroundTextSource: "manual" });
      const flat = toFlat(reconcileLine(input));
      expect(flat.backgroundTextSource).toBe("manual");
      expect(flat).toEqual(input);
    });

    it("survives the round-trip for a word-synced extraction background", () => {
      const input = loose({ backgroundText: "ah oh", backgroundWords: bgWords, backgroundTextSource: "extraction" });
      const flat = toFlat(reconcileLine(input));
      expect(flat.backgroundTextSource).toBe("extraction");
      expect(flat).toEqual(input);
    });

    it("survives the round-trip for a word-synced manual background", () => {
      const input = loose({ backgroundText: "ah oh", backgroundWords: bgWords, backgroundTextSource: "manual" });
      const flat = toFlat(reconcileLine(input));
      expect(flat.backgroundTextSource).toBe("manual");
      expect(flat).toEqual(input);
    });
  });
});

// -- edge cases ---------------------------------------------------------------

describe("edge cases", () => {
  describe("empty words array", () => {
    it("stores main = { text, words: [] } verbatim and classifies the line untimed", () => {
      const reconciled = reconcileLine(loose({ words: [] }));
      expect(reconciled.main).toEqual({ text: "Hello world", words: [] });
      expect("words" in reconciled.main).toBe(true);
      expect(isUntimed(reconciled.main)).toBe(true);
      expect(isWordSynced(reconciled.main)).toBe(false);
    });

    it("toFlat emits words: [] (not dropped) and round-trips", () => {
      const input = loose({ words: [] });
      const flat = toFlat(reconcileLine(input));
      expect(flat.words).toEqual([]);
      expect("words" in flat).toBe(true);
      expect("begin" in flat).toBe(false);
      expect("end" in flat).toBe(false);
      expect(flat).toEqual(input);
    });
  });

  describe("empty background words array", () => {
    it("does not create a word-synced background and emits no background when text is absent", () => {
      const reconciled = reconcileLine(loose({ backgroundWords: [] }));
      expect(reconciled.background).toBeUndefined();
    });

    it("keeps a text-only background when backgroundWords is empty but backgroundText is set", () => {
      const reconciled = reconcileLine(loose({ backgroundText: "ooh", backgroundWords: [] }));
      expect(reconciled.background).toEqual({ text: "ooh", source: undefined });
      expect("words" in (reconciled.background ?? {})).toBe(false);
    });
  });

  describe("whitespace and unicode text", () => {
    it("preserves padded text verbatim through a round-trip", () => {
      const input = loose({ text: "  héllo  ", begin: 2, end: 4 });
      expect(toFlat(reconcileLine(input))).toEqual(input);
    });

    it("preserves a trailing space verbatim through a round-trip", () => {
      const input = loose({ text: "Hello " });
      const flat = toFlat(reconcileLine(input));
      expect(flat.text).toBe("Hello ");
      expect(flat).toEqual(input);
    });

    it("preserves unicode main and background text verbatim", () => {
      const input = loose({ text: "안녕 🎵", begin: 1, end: 2, backgroundText: "コーラス 🎶" });
      const flat = toFlat(reconcileLine(input));
      expect(flat.text).toBe("안녕 🎵");
      expect(flat.backgroundText).toBe("コーラス 🎶");
      expect(flat).toEqual(input);
    });
  });
});

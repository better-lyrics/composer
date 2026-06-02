import { describe, expect, it } from "vitest";
import { reconcileLine } from "@/domain/line/model";
import type { LineFields, RomanizationData } from "@/domain/line/model";

describe("RomanizationData shape", () => {
  it("has text, wordTexts, source; no words field", () => {
    const data: RomanizationData = { text: "yoru dakedo", wordTexts: ["yoru", "dakedo"], source: "generated" };
    expect(data.text).toBe("yoru dakedo");
    expect(data.wordTexts).toEqual(["yoru", "dakedo"]);
    // @ts-expect-error v1 `words` field is gone.
    void data.words;
  });

  it("wordTexts is optional (line-level only romanization)", () => {
    const data: RomanizationData = { text: "yoru dakedo", source: "manual" };
    expect(data.wordTexts).toBeUndefined();
  });

  it("LineFields accepts romanization with wordTexts", () => {
    const line: LineFields = {
      id: "L1",
      text: "夜だけど",
      agentId: "v1",
      romanization: { text: "yoru dakedo", wordTexts: ["yoru", "dakedo"], source: "generated" },
    };
    expect(line.romanization?.wordTexts?.length).toBe(2);
  });
});

describe("reconcileLine - romanization", () => {
  it("preserves romanization on a word-synced line", () => {
    const reconciled = reconcileLine({
      id: "L1",
      text: "夜だけど",
      agentId: "v1",
      words: [{ text: "夜", begin: 0, end: 1 }],
      romanization: {
        text: "yoru dakedo",
        wordTexts: ["yoru", "dakedo"],
        source: "generated",
      },
    });
    expect(reconciled.romanization?.text).toBe("yoru dakedo");
    expect(reconciled.romanization?.source).toBe("generated");
    expect(reconciled.romanization?.wordTexts?.[0]).toBe("yoru");
  });

  it("preserves romanization on a line-synced line", () => {
    const reconciled = reconcileLine({
      id: "L1",
      text: "夜だけど",
      agentId: "v1",
      begin: 0,
      end: 4,
      romanization: { text: "yoru dakedo", source: "manual" },
    });
    expect(reconciled.romanization?.text).toBe("yoru dakedo");
    expect(reconciled.romanization?.wordTexts).toBeUndefined();
  });

  it("preserves romanization on an untimed line", () => {
    const reconciled = reconcileLine({
      id: "L1",
      text: "夜だけど",
      agentId: "v1",
      romanization: { text: "yoru dakedo", source: "manual" },
    });
    expect(reconciled.romanization?.source).toBe("manual");
  });

  it("allows romanization to be absent", () => {
    const reconciled = reconcileLine({ id: "L1", text: "hello", agentId: "v1" });
    expect(reconciled.romanization).toBeUndefined();
  });
});

describe("reconcileLine - romanization invariant", () => {
  it("keeps wordTexts when length matches line.words", () => {
    const reconciled = reconcileLine({
      id: "L1",
      text: "夜 だけど",
      agentId: "v1",
      words: [
        { text: "夜", begin: 0, end: 1 },
        { text: "だけど", begin: 1, end: 2 },
      ],
      romanization: { text: "yoru dakedo", wordTexts: ["yoru", "dakedo"], source: "generated" },
    });
    expect(reconciled.romanization?.wordTexts).toEqual(["yoru", "dakedo"]);
  });

  it("drops wordTexts (keeps text + source) when length does not match line.words", () => {
    const reconciled = reconcileLine({
      id: "L1",
      text: "夜 だけど",
      agentId: "v1",
      words: [
        { text: "夜", begin: 0, end: 1 },
        { text: "だけど", begin: 1, end: 2 },
      ],
      romanization: { text: "yoru dakedo something", wordTexts: ["yoru"], source: "generated" },
    });
    expect(reconciled.romanization?.text).toBe("yoru dakedo something");
    expect(reconciled.romanization?.source).toBe("generated");
    expect(reconciled.romanization?.wordTexts).toBeUndefined();
  });

  it("drops wordTexts when the line is line-synced (no words array)", () => {
    const reconciled = reconcileLine({
      id: "L1",
      text: "夜だけど",
      agentId: "v1",
      begin: 0,
      end: 2,
      romanization: { text: "yoru dakedo", wordTexts: ["yoru", "dakedo"], source: "generated" },
    });
    expect(reconciled.romanization?.wordTexts).toBeUndefined();
    expect(reconciled.romanization?.text).toBe("yoru dakedo");
  });

  it("drops wordTexts when the line is untimed (no words and no begin/end)", () => {
    const reconciled = reconcileLine({
      id: "L1",
      text: "夜だけど",
      agentId: "v1",
      romanization: { text: "yoru dakedo", wordTexts: ["yoru", "dakedo"], source: "generated" },
    });
    expect(reconciled.romanization?.wordTexts).toBeUndefined();
  });

  it("clears romanization entirely when text is the empty string", () => {
    const reconciled = reconcileLine({
      id: "L1",
      text: "夜",
      agentId: "v1",
      words: [{ text: "夜", begin: 0, end: 1 }],
      romanization: { text: "", source: "manual" },
    });
    expect(reconciled.romanization).toBeUndefined();
  });

  it("clears romanization when text is empty even with non-empty wordTexts", () => {
    const reconciled = reconcileLine({
      id: "L1",
      text: "夜",
      agentId: "v1",
      words: [{ text: "夜", begin: 0, end: 1 }],
      romanization: { text: "", wordTexts: ["yoru"], source: "manual" },
    });
    expect(reconciled.romanization).toBeUndefined();
  });

  it("returns the same input identity when no romanization adjustment is needed (immutability check)", () => {
    const romanization = { text: "yoru", wordTexts: ["yoru"], source: "generated" as const };
    const line = {
      id: "L1",
      text: "夜",
      agentId: "v1",
      words: [{ text: "夜", begin: 0, end: 1 }],
      romanization,
    };
    const reconciled = reconcileLine(line);
    expect(reconciled.romanization).toBe(romanization);
  });

  it("does not mutate the input when dropping wordTexts (creates a new romanization object)", () => {
    const original = { text: "yoru dakedo", wordTexts: ["yoru"], source: "generated" as const };
    const line = {
      id: "L1",
      text: "夜 だけど",
      agentId: "v1",
      words: [
        { text: "夜", begin: 0, end: 1 },
        { text: "だけど", begin: 1, end: 2 },
      ],
      romanization: original,
    };
    reconcileLine(line);
    expect(original.wordTexts).toEqual(["yoru"]);
  });

  it("preserves background fields and other line metadata while adjusting romanization", () => {
    const reconciled = reconcileLine({
      id: "L1",
      text: "夜",
      agentId: "v1",
      backgroundText: "echo",
      backgroundWords: [{ text: "echo", begin: 0, end: 1 }],
      groupId: "G1",
      instanceIdx: 2,
      begin: 0,
      end: 1,
      romanization: { text: "yoru", wordTexts: ["yoru"], source: "generated" },
    });
    expect(reconciled.backgroundText).toBe("echo");
    expect(reconciled.backgroundWords?.[0]?.text).toBe("echo");
    expect(reconciled.groupId).toBe("G1");
    expect(reconciled.instanceIdx).toBe(2);
    expect(reconciled.romanization?.wordTexts).toBeUndefined();
  });

  it("drops only wordTexts on mismatch even when wordTexts is an empty array (length 0 vs words length > 0)", () => {
    const reconciled = reconcileLine({
      id: "L1",
      text: "夜",
      agentId: "v1",
      words: [{ text: "夜", begin: 0, end: 1 }],
      romanization: { text: "yoru", wordTexts: [], source: "generated" },
    });
    expect(reconciled.romanization?.wordTexts).toBeUndefined();
    expect(reconciled.romanization?.text).toBe("yoru");
  });
});

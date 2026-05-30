import { describe, expect, it } from "vitest";
import { reconcileLine } from "@/domain/line/model";

describe("reconcileLine - romanization", () => {
  it("preserves romanization on a word-synced line", () => {
    const reconciled = reconcileLine({
      id: "L1",
      text: "夜だけど",
      agentId: "v1",
      words: [{ text: "夜", begin: 0, end: 1 }],
      romanization: {
        text: "yoru dakedo",
        words: [{ text: "yoru", begin: 0, end: 1 }],
        source: "generated",
      },
    });
    expect(reconciled.romanization?.text).toBe("yoru dakedo");
    expect(reconciled.romanization?.source).toBe("generated");
    expect(reconciled.romanization?.words?.[0].text).toBe("yoru");
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
    expect(reconciled.romanization?.words).toBeUndefined();
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

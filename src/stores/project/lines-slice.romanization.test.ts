import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";

describe("lines-slice: romanization", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
    useProjectStore.getState().setLines([
      { id: "L1", text: "夜だけど", agentId: "v1" },
      { id: "L2", text: "hello", agentId: "v1" },
    ]);
  });

  it("setLineRomanization stores text and source", () => {
    useProjectStore.getState().setLineRomanization("L1", {
      text: "yoru dakedo",
      source: "manual",
    });
    const line = useProjectStore.getState().lines.find((l) => l.id === "L1");
    expect(line?.romanization).toEqual({ text: "yoru dakedo", source: "manual" });
  });

  it("setLineRomanization with words attaches timing", () => {
    useProjectStore.getState().setLineRomanization("L1", {
      text: "yoru dakedo",
      source: "generated",
      words: [
        { text: "yoru", begin: 0, end: 1 },
        { text: "dakedo", begin: 1, end: 2 },
      ],
    });
    const line = useProjectStore.getState().lines.find((l) => l.id === "L1");
    expect(line?.romanization?.words?.length).toBe(2);
    expect(line?.romanization?.words?.[0].text).toBe("yoru");
    expect(line?.romanization?.source).toBe("generated");
  });

  it("setLineRomanization replaces previous romanization atomically", () => {
    useProjectStore.getState().setLineRomanization("L1", { text: "first", source: "manual" });
    useProjectStore.getState().setLineRomanization("L1", { text: "second", source: "generated" });
    const line = useProjectStore.getState().lines.find((l) => l.id === "L1");
    expect(line?.romanization?.text).toBe("second");
    expect(line?.romanization?.source).toBe("generated");
  });

  it("clearLineRomanization removes the field", () => {
    useProjectStore.getState().setLineRomanization("L1", { text: "yoru", source: "manual" });
    useProjectStore.getState().clearLineRomanization("L1");
    const line = useProjectStore.getState().lines.find((l) => l.id === "L1");
    expect(line?.romanization).toBeUndefined();
  });

  it("clearLineRomanization is a no-op on unknown line id", () => {
    const before = useProjectStore.getState().lines;
    expect(() => useProjectStore.getState().clearLineRomanization("LXX")).not.toThrow();
    expect(useProjectStore.getState().lines).toEqual(before);
  });

  it("setLineRomanization is a no-op on unknown line id", () => {
    const before = useProjectStore.getState().lines;
    useProjectStore.getState().setLineRomanization("LXX", { text: "x", source: "manual" });
    expect(useProjectStore.getState().lines).toEqual(before);
  });

  it("setLineRomanization marks isDirtySinceHistory", () => {
    useProjectStore.getState().setLineRomanization("L1", { text: "yoru", source: "manual" });
    expect(useProjectStore.getState().isDirtySinceHistory).toBe(true);
  });

  it("clearLineRomanization marks isDirtySinceHistory", () => {
    useProjectStore.getState().setLineRomanization("L1", { text: "yoru", source: "manual" });
    useProjectStore.getState().setLines(useProjectStore.getState().lines);
    useProjectStore.getState().clearLineRomanization("L1");
    expect(useProjectStore.getState().isDirtySinceHistory).toBe(true);
  });

  it("setLineRomanization throws on empty text", () => {
    expect(() => useProjectStore.getState().setLineRomanization("L1", { text: "", source: "manual" })).toThrow(
      /empty/i,
    );
  });

  it("setLineRomanization preserves other line fields", () => {
    useProjectStore.getState().setLineRomanization("L1", { text: "yoru dakedo", source: "manual" });
    const line = useProjectStore.getState().lines.find((l) => l.id === "L1");
    expect(line?.text).toBe("夜だけど");
    expect(line?.agentId).toBe("v1");
  });

  it("setLineRomanization does not touch siblings", () => {
    useProjectStore.getState().setLineRomanization("L1", { text: "yoru", source: "manual" });
    const l2 = useProjectStore.getState().lines.find((l) => l.id === "L2");
    expect(l2?.romanization).toBeUndefined();
  });
});

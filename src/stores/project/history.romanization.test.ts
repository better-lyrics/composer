import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";

describe("history: romanization", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
    useProjectStore.getState().clearHistory();
    useProjectStore.getState().setLines([{ id: "L1", text: "夜", agentId: "v1" }]);
  });

  it("setLineRomanizationWithHistory writes romanization", () => {
    useProjectStore.getState().setLineRomanizationWithHistory("L1", { text: "yoru", source: "manual" });
    const line = useProjectStore.getState().lines.find((l) => l.id === "L1");
    expect(line?.romanization?.text).toBe("yoru");
  });

  it("setLineRomanizationWithHistory creates a history entry", () => {
    useProjectStore.getState().setLineRomanizationWithHistory("L1", { text: "yoru", source: "manual" });
    expect(useProjectStore.getState().canUndo()).toBe(true);
  });

  it("undo restores the pre-set state", () => {
    useProjectStore.getState().setLineRomanizationWithHistory("L1", { text: "yoru", source: "manual" });
    useProjectStore.getState().undo();
    const line = useProjectStore.getState().lines.find((l) => l.id === "L1");
    expect(line?.romanization).toBeUndefined();
  });

  it("undo restores cleared romanization", () => {
    useProjectStore.getState().setLineRomanizationWithHistory("L1", { text: "yoru", source: "manual" });
    useProjectStore.getState().clearLineRomanizationWithHistory("L1");
    useProjectStore.getState().undo();
    const line = useProjectStore.getState().lines.find((l) => l.id === "L1");
    expect(line?.romanization?.text).toBe("yoru");
  });

  it("redo re-applies the set", () => {
    useProjectStore.getState().setLineRomanizationWithHistory("L1", { text: "yoru", source: "manual" });
    useProjectStore.getState().undo();
    useProjectStore.getState().redo();
    const line = useProjectStore.getState().lines.find((l) => l.id === "L1");
    expect(line?.romanization?.text).toBe("yoru");
  });

  it("redo re-applies the clear", () => {
    useProjectStore.getState().setLineRomanizationWithHistory("L1", { text: "yoru", source: "manual" });
    useProjectStore.getState().clearLineRomanizationWithHistory("L1");
    useProjectStore.getState().undo();
    useProjectStore.getState().redo();
    const line = useProjectStore.getState().lines.find((l) => l.id === "L1");
    expect(line?.romanization).toBeUndefined();
  });

  it("setLineRomanizationWithHistory resets isDirtySinceHistory", () => {
    useProjectStore.getState().setLines(useProjectStore.getState().lines);
    expect(useProjectStore.getState().isDirtySinceHistory).toBe(true);
    useProjectStore.getState().setLineRomanizationWithHistory("L1", { text: "yoru", source: "manual" });
    expect(useProjectStore.getState().isDirtySinceHistory).toBe(false);
  });

  it("setLineRomanizationWithHistory captures a pending non-history edit so undo lands on it", () => {
    useProjectStore
      .getState()
      .setLines([{ id: "L1", text: "夜", agentId: "v1", words: [{ text: "夜", begin: 0, end: 1 }] }]);
    useProjectStore.getState().setLineRomanizationWithHistory("L1", { text: "yoru", source: "manual" });
    useProjectStore.getState().undo();
    const line = useProjectStore.getState().lines.find((l) => l.id === "L1");
    expect(line?.romanization).toBeUndefined();
    expect(line?.words?.[0].text).toBe("夜");
  });

  it("setLineRomanizationWithHistory stores empty text cleanly without throwing", () => {
    expect(() =>
      useProjectStore.getState().setLineRomanizationWithHistory("L1", { text: "", source: "manual" }),
    ).not.toThrow();
    const line = useProjectStore.getState().lines.find((l) => l.id === "L1");
    expect(line?.romanization).toEqual({ text: "", source: "manual" });
  });

  it("setLineRomanizationWithHistory is a no-op when line is missing", () => {
    const before = useProjectStore.getState().lines;
    useProjectStore.getState().setLineRomanizationWithHistory("LXX", { text: "x", source: "manual" });
    expect(useProjectStore.getState().lines).toEqual(before);
    expect(useProjectStore.getState().canUndo()).toBe(false);
  });

  it("clearLineRomanizationWithHistory is a no-op when line is missing", () => {
    expect(() => useProjectStore.getState().clearLineRomanizationWithHistory("LXX")).not.toThrow();
    expect(useProjectStore.getState().canUndo()).toBe(false);
  });

  it("clearLineRomanizationWithHistory does not create a history entry on an already-clear line", () => {
    useProjectStore.getState().clearLineRomanizationWithHistory("L1");
    expect(useProjectStore.getState().canUndo()).toBe(false);
  });

  it("multiple romanization edits each create undoable steps", () => {
    useProjectStore.getState().setLineRomanizationWithHistory("L1", { text: "first", source: "manual" });
    useProjectStore.getState().setLineRomanizationWithHistory("L1", { text: "second", source: "generated" });
    useProjectStore.getState().undo();
    const afterFirstUndo = useProjectStore.getState().lines.find((l) => l.id === "L1");
    expect(afterFirstUndo?.romanization?.text).toBe("first");
    useProjectStore.getState().undo();
    const afterSecondUndo = useProjectStore.getState().lines.find((l) => l.id === "L1");
    expect(afterSecondUndo?.romanization).toBeUndefined();
  });
});

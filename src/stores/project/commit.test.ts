/**
 * @vitest-environment node
 */
import { editLines, replaceLines } from "@/domain/commands/line-edits";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { beforeEach, describe, expect, it } from "vitest";

const typed = (text: string) => editLines([{ id: "l1", updates: { text } }], { propagateToSiblings: false });

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().commit(replaceLines([createLine({ id: "l1", text: "Lanterns" })]));
});

describe("commit", () => {
  it("a pending burst is one undo step and carries its note", () => {
    const { commit } = useProjectStore.getState();
    commit(typed("Lanterns over"), "pending");
    commit(typed("Lanterns over the"), "pending");
    commit(typed("Lanterns over the river"), "pending");

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines[0].text).toBe("Lanterns");

    useProjectStore.getState().redo();
    const { lines, history, historyIndex } = useProjectStore.getState();
    expect(lines[0].text).toBe("Lanterns over the river");
    expect(history[historyIndex].note).toEqual({ command: "edit lines", args: ["l1"] });
  });
});

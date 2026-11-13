/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it } from "vitest";
import { pasteLyrics } from "@/domain/commands/edit-text";
import { addGroup } from "@/domain/commands/group-edits";
import { lineEditCommand } from "@/domain/commands/line-edits";
import { lineText } from "@/domain/line/text";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { fieldUpdates } from "@/test/field-updates";

const typed = (text: string) =>
  lineEditCommand({ command: "edit lines", args: ["l1"] }, () => fieldUpdates([{ id: "l1", updates: { text } }]), {
    propagateToSiblings: false,
  });

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore
    .getState()
    .commit(pasteLyrics(useProjectStore.getState().lines, [createLine({ id: "l1", text: "Lanterns" })]));
});

describe("commit", () => {
  it("a pending burst is one undo step and carries its note", () => {
    const { commit } = useProjectStore.getState();
    commit(typed("Lanterns over"), "pending");
    commit(typed("Lanterns over the"), "pending");
    commit(typed("Lanterns over the river"), "pending");

    useProjectStore.getState().undo();
    expect(lineText(useProjectStore.getState().lines[0])).toBe("Lanterns");

    useProjectStore.getState().redo();
    const { lines, history, historyIndex } = useProjectStore.getState();
    expect(lineText(lines[0])).toBe("Lanterns over the river");
    expect(history[historyIndex].note).toEqual({ command: "edit lines", args: ["l1"] });
  });

  it("a command that changes no line keeps the lines array", () => {
    const before = useProjectStore.getState().lines;
    useProjectStore.getState().commit(addGroup({ id: "g1", label: "Chorus", color: "#ffffff", templateVersion: 1 }));
    expect(useProjectStore.getState().groups).toHaveLength(1);
    expect(useProjectStore.getState().lines).toBe(before);
  });
});

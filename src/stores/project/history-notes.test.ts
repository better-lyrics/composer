/**
 * @vitest-environment node
 */
import { insertEmptyLine } from "@/domain/commands/line-edits";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.setState({ lines: [createLine({ id: "l1", text: "Paper lanterns" })] });
});

describe("history notes", () => {
  it("records the command on its step and undo ignores it", () => {
    useProjectStore.getState().commit(insertEmptyLine({ anchorLineId: "l1", position: "below" }));
    const { history, historyIndex } = useProjectStore.getState();
    expect(history[historyIndex].note).toEqual({ command: "insert line", args: ["l1", "below"] });
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines).toHaveLength(1);
  });
});

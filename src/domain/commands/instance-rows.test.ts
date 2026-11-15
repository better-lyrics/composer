/**
 * @vitest-environment node
 */
import { deleteLine } from "@/domain/commands/instance-rows";
import { replaceLines } from "@/domain/commands/line-edits";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().commit(replaceLines([createLine({ id: "l1", text: "Over the hills" })]));
});

describe("line commands", () => {
  it("refuses to delete a line that is already gone and records no step", () => {
    useProjectStore.getState().commit(deleteLine("l1"));
    const before = useProjectStore.getState().history;
    const outcome = useProjectStore.getState().commit(deleteLine("l1"));
    expect(outcome).toEqual({ refused: { reason: "line-gone", lineId: "l1" } });
    expect(useProjectStore.getState().history).toBe(before);
  });
});

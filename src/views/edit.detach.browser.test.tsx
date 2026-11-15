import { toast } from "sonner";
import { describe, expect, it } from "vitest";
import { lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "insync/line";
import { lineText } from "insync/line-text";
import { useProjectStore } from "@/stores/project";
import { createGroup } from "@/test/factories";
import { render } from "@/test/render";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { EditPanel } from "@/views/edit";
import { getSplitCharacter } from "@/utils/split-character";

// -- Helpers ------------------------------------------------------------------

function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function linkedProjectLines(): LyricLine[] {
  return [
    lineFromFields(
      { id: "a0", text: "Verse one", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 },
      getSplitCharacter(),
    ),
    lineFromFields(
      { id: "a1", text: "Verse two", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 1 },
      getSplitCharacter(),
    ),
    lineFromFields(
      { id: "b0", text: "Verse one", agentId: "v1", groupId: "g1", instanceIdx: 1, templateLineIdx: 0 },
      getSplitCharacter(),
    ),
    lineFromFields(
      { id: "b1", text: "Verse two", agentId: "v1", groupId: "g1", instanceIdx: 1, templateLineIdx: 1 },
      getSplitCharacter(),
    ),
  ];
}

// -- Tests --------------------------------------------------------------------

describe("editor rows of a group instance", () => {
  it("a removed row leaves the rest of its instance grouped, without asking, and undo brings it back", async () => {
    useProjectStore.setState({
      lines: linkedProjectLines(),
      groups: [createGroup({ id: "g1", label: "Chorus" })],
    });
    const screen = await render(
      <>
        <EditPanel />
        <ConfirmModalHost />
      </>,
    );
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;

    setTextareaValue(textarea, "Verse one\nVerse two\nVerse one");

    await expect
      .poll(() => useProjectStore.getState().lines.map((l) => lineText(l, getSplitCharacter())))
      .toEqual(["Verse one", "Verse two", "Verse one"]);
    expect(screen.container.querySelector("[role=dialog]")).toBeNull();
    expect(useProjectStore.getState().lines.map((l) => l.instanceIdx)).toEqual([0, 0, 1]);
    expect(toast.getHistory().some((t) => "title" in t && t.title === '"Verse two" now differs in Chorus 2')).toBe(
      true,
    );

    textarea.focus();
    textarea.blur();
    useProjectStore.getState().undo();
    await expect.poll(() => useProjectStore.getState().lines.length).toBe(4);
    expect(useProjectStore.getState().lines.filter((l) => l.instanceIdx === 1)).toHaveLength(2);
    expect(useProjectStore.getState().groups.map((g) => g.id)).toEqual(["g1"]);
  });
});

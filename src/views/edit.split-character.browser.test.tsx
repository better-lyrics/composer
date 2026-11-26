import { beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { mainTrack } from "@/domain/line/track";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { EditPanel } from "@/views/edit";

beforeEach(() => {
  useProjectStore.setState({ activeTab: "edit" });
});

describe("EditPanel · split character", () => {
  it("regression: changing the split character with Edit open keeps every split word's syllables and timing", async () => {
    useSettingsStore.setState({ splitCharacter: "|" });
    const line = createLine({
      id: "l1",
      text: "hel|lo world",
      words: [
        { text: "hel", sep: "", begin: 1, end: 1.4, joinsNext: true },
        { text: "lo", sep: " ", begin: 1.4, end: 2 },
        { text: "world", begin: 2, end: 3 },
      ],
    });
    useProjectStore.setState({ lines: [line] });
    const syllablesBefore = mainTrack(line).syllables;
    const screen = await render(<EditPanel />);
    const textarea = screen.getByRole("textbox");

    useSettingsStore.setState({ splitCharacter: "/" });
    await expect.element(textarea).toHaveValue("hel/lo world");
    const element = textarea.element() as HTMLTextAreaElement;
    await userEvent.click(textarea);
    element.setSelectionRange(element.value.length, element.value.length);
    await userEvent.keyboard("!");

    const syllables = mainTrack(useProjectStore.getState().lines[0]).syllables;
    expect(syllables.map(({ text, begin, end }) => [text, begin, end])).toEqual([
      ["hel", 1, 1.4],
      ["lo", 1.4, 2],
      ["world!", 2, 3],
    ]);
    expect(syllables.slice(0, 2)).toEqual(syllablesBefore.slice(0, 2));
  });
});

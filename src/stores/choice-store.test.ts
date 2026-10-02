import { askChoice, useChoiceStore } from "@/stores/choice-store";
import { describe, expect, it, vi } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const KEEP_OR_REPLACE = {
  title: "Project already in your library",
  body: "Alpha",
  busyMessage: "Finish the current import first",
  options: [
    { value: "keep-both", label: "Keep both", variant: "secondary" },
    { value: "replace", label: "Replace project", variant: "destructive" },
  ],
} as const;

// -- Tests --------------------------------------------------------------------

describe("askChoice", () => {
  it("resolves the prompt with the chosen answer and closes it", async () => {
    const choice = askChoice(KEEP_OR_REPLACE);
    expect(useChoiceStore.getState().request?.title).toBe("Project already in your library");
    useChoiceStore.getState().answer("keep-both");
    await expect(choice).resolves.toBe("keep-both");
    expect(useChoiceStore.getState().request).toBeNull();
  });

  it("resolves cancel when the prompt is cancelled", async () => {
    const choice = askChoice(KEEP_OR_REPLACE);
    useChoiceStore.getState().answer("cancel");
    await expect(choice).resolves.toBe("cancel");
    expect(useChoiceStore.getState().request).toBeNull();
  });

  describe("edge cases", () => {
    it("cancels a second prompt while one is open and warns", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const first = askChoice(KEEP_OR_REPLACE);
      await expect(askChoice(KEEP_OR_REPLACE)).resolves.toBe("cancel");
      useChoiceStore.getState().answer("replace");
      await expect(first).resolves.toBe("replace");
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it("treats an answer that is not one of the options as cancel", async () => {
      const choice = askChoice(KEEP_OR_REPLACE);
      useChoiceStore.getState().answer("restore");
      await expect(choice).resolves.toBe("cancel");
    });

    it("ignores an answer when no prompt is open", () => {
      expect(() => useChoiceStore.getState().answer("replace")).not.toThrow();
      expect(useChoiceStore.getState().request).toBeNull();
    });

    it("closes the prompt before the answer resolves, so the caller can ask again at once", async () => {
      const first = askChoice(KEEP_OR_REPLACE).then(() => askChoice(KEEP_OR_REPLACE));
      useChoiceStore.getState().answer("keep-both");
      await expect.poll(() => useChoiceStore.getState().request).not.toBeNull();
      useChoiceStore.getState().answer("replace");
      await expect(first).resolves.toBe("replace");
    });
  });
});

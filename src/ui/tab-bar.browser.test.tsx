import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";
import { TabBar } from "@/ui/tab-bar";
import { beforeEach, describe, expect, it } from "vitest";

const TAB_NAME_REGEX = {
  Import: /^Import/,
  Edit: /^Edit/,
  Languages: /^Languages/,
  Sync: /^Sync/,
  Timeline: /^Timeline/,
  Preview: /^Preview/,
  Export: /^Export/,
} as const;

describe("TabBar", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
    useSettingsStore.getState().resetToDefaults();
  });

  it("renders one button per tab", async () => {
    const screen = await render(<TabBar />);
    await Promise.all(
      Object.values(TAB_NAME_REGEX).map((nameRegex) =>
        expect.element(screen.getByRole("button", { name: nameRegex })).toBeInTheDocument(),
      ),
    );
  });

  it("highlights the currently active tab from the project store", async () => {
    useProjectStore.setState({ activeTab: "sync" });
    const screen = await render(<TabBar />);
    const syncButton = screen.getByRole("button", { name: /^Sync/ }).element();
    expect(syncButton.className).toContain("border-composer-accent");
  });

  it("dispatches setActiveTab on the project store when a tab is clicked", async () => {
    useProjectStore.setState({ activeTab: "import" });
    const screen = await render(<TabBar />);
    await screen.getByRole("button", { name: /^Timeline/ }).click();
    expect(useProjectStore.getState().activeTab).toBe("timeline");
  });

  it("hides shortcut hints when settings.showShortcutHints is false", async () => {
    useSettingsStore.setState({ showShortcutHints: false });
    const screen = await render(<TabBar />);
    expect(screen.container.querySelector("svg")).toBeNull();
  });

  it("shows shortcut hints when settings.showShortcutHints is true", async () => {
    useSettingsStore.setState({ showShortcutHints: true });
    const screen = await render(<TabBar />);
    expect(screen.container.querySelectorAll("button > span > span").length).toBeGreaterThan(0);
  });

  it("shows the number of lines needing language review on the Languages tab", async () => {
    useSettingsStore.setState({ showShortcutHints: false });
    useProjectStore.getState().setLines([
      {
        id: "l1",
        text: "changed lyric",
        agentId: "v1",
        transliteration: {
          language: "ko-Latn",
          text: "romanization",
          segments: [],
          origin: "manual",
          sourceFingerprint: "old-source",
        },
      },
    ]);

    const screen = await render(<TabBar />);
    const warning = screen.container.querySelector("[data-language-review-count]");

    expect(warning).not.toBeNull();
    expect(warning?.textContent).toContain("1");
    await expect.element(screen.getByLabelText("1 line needs language review")).toBeInTheDocument();
  });

  it("shows the number of lines with alignment errors on the Languages tab", async () => {
    useSettingsStore.setState({ showShortcutHints: false });
    useProjectStore.getState().setLines([
      {
        id: "l1",
        text: "가|나",
        agentId: "v1",
        words: [
          { text: "가", begin: 0, end: 0.5, syllableGroupId: "group" },
          { text: "나", begin: 0.5, end: 1, syllableGroupId: "group" },
        ],
        transliteration: {
          language: "ko-Latn",
          text: "g",
          segments: [],
          origin: "manual",
          sourceFingerprint: "current",
        },
      },
    ]);

    const screen = await render(<TabBar />);
    const error = screen.container.querySelector("[data-language-error-count]");

    expect(error).not.toBeNull();
    expect(error?.textContent).toContain("1");
    await expect.element(screen.getByLabelText("1 line has a language alignment error")).toBeInTheDocument();
  });
});

import { indexEntry } from "@/test/index-entries";
import { render } from "@/test/render";
import { ProjectAudioRow } from "@/ui/settings/storage/project-audio-row";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Fixtures -----------------------------------------------------------------

const NOW = 1_759_000_000_000;
const LOCAL = indexEntry("a", {
  title: "Midnight City",
  audioKind: "file",
  storedAudioBytes: 43_830_067,
  openedAt: NOW - 12 * 60_000,
});

function renderRow(overrides: Partial<Parameters<typeof ProjectAudioRow>[0]> = {}) {
  const removed: string[] = [];
  const result = render(
    <ul>
      <ProjectAudioRow
        entry={LOCAL}
        isOpen={false}
        now={NOW}
        onRemove={(entry) => removed.push(entry.id)}
        {...overrides}
      />
    </ul>,
  );
  return { result, removed };
}

// -- Tests --------------------------------------------------------------------

describe("ProjectAudioRow", () => {
  it("shows the title, when it was opened, the kind and the size", async () => {
    const { result } = renderRow();
    const screen = await result;
    await expect.element(screen.getByText("Midnight City")).toBeInTheDocument();
    await expect.element(screen.getByText("Opened 12 min ago")).toBeInTheDocument();
    await expect.element(screen.getByText("Local file")).toBeInTheDocument();
    await expect.element(screen.getByText("41.8 MB")).toBeInTheDocument();
  });

  it("removes the audio", async () => {
    const { result, removed } = renderRow();
    const screen = await result;
    await screen.getByRole("button", { name: "Remove audio from Midnight City" }).click();
    expect(removed).toEqual(["a"]);
  });

  it("keeps the label as a tooltip while enabled", async () => {
    const { result } = renderRow();
    const screen = await result;
    await expect
      .element(screen.getByRole("button", { name: "Remove audio from Midnight City" }))
      .toHaveAttribute("title", "Remove audio from Midnight City");
  });

  it("removes from the keyboard", async () => {
    const { result, removed } = renderRow();
    await result;
    await userEvent.keyboard("{Tab}{Enter}");
    expect(removed).toEqual(["a"]);
  });

  it("labels YouTube audio", async () => {
    const { result } = renderRow({ entry: { ...LOCAL, audioKind: "youtube" } });
    const screen = await result;
    await expect.element(screen.getByText("YouTube")).toBeInTheDocument();
  });

  describe("the open project", () => {
    it("cannot remove its audio and says why", async () => {
      const { result, removed } = renderRow({ isOpen: true });
      const screen = await result;
      const button = screen.getByRole("button", { name: "Close Midnight City to remove its audio" });
      await expect.element(button).toHaveAttribute("aria-disabled", "true");
      await expect.element(button).toHaveAttribute("title", "Close this project to remove its audio");
      await button.click({ force: true });
      await userEvent.keyboard("{Enter}");
      expect(removed).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("names an untitled project and falls back to the last edit without openedAt", async () => {
      const { result } = renderRow({
        entry: { ...LOCAL, title: "", openedAt: undefined, updatedAt: NOW - 2 * 3_600_000 },
      });
      const screen = await result;
      await expect.element(screen.getByText("Untitled")).toBeInTheDocument();
      await expect.element(screen.getByText("Opened 2 h ago")).toBeInTheDocument();
    });
  });
});

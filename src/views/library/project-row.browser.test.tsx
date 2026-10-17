import { countingIndexEntry, indexEntry } from "@/test/index-entries";
import { render } from "@/test/render";
import { ProjectRow } from "@/views/library/project-row";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Constants ----------------------------------------------------------------

const NOW = new Date(2026, 8, 27, 12, 0, 0).getTime();
const noop = () => {};

// -- Helpers ------------------------------------------------------------------

function renderRow(overrides: Parameters<typeof indexEntry>[1] = {}, onOpen: (id: string) => void = noop) {
  return render(
    <ul>
      <ProjectRow
        project={indexEntry("p01", {
          title: "Midnight City",
          artists: ["M83"],
          album: "Hurry Up, We're Dreaming",
          lineCount: 38,
          syncedLineCount: 23,
          hasWordTiming: true,
          audioKind: "file",
          audioFileName: "midnight.flac",
          storedAudioBytes: 43_830_067,
          updatedAt: NOW - 12 * 60_000,
          ...overrides,
        })}
        now={NOW}
        isSelected={false}
        isMenuOpen={false}
        onOpen={onOpen}
        onToggleSelect={noop}
        onOpenMenu={noop}
      />
    </ul>,
  );
}

// -- Tests --------------------------------------------------------------------

describe("ProjectRow", () => {
  it("shows the title, artist, album, progress, audio and edited time", async () => {
    const screen = await renderRow();
    await expect.element(screen.getByRole("button", { name: "Midnight City", exact: true })).toBeInTheDocument();
    await expect.element(screen.getByText("M83")).toBeInTheDocument();
    await expect.element(screen.getByText("Hurry Up, We're Dreaming")).toBeInTheDocument();
    await expect
      .element(screen.getByRole("progressbar", { name: "23 of 38 lines synced, word by word" }))
      .toBeInTheDocument();
    await expect.element(screen.getByText("61%")).toBeInTheDocument();
    await expect.element(screen.getByText("FLAC")).toBeInTheDocument();
    await expect.element(screen.getByText("12 min ago")).toBeInTheDocument();
  });

  it("shows a check for a synced project", async () => {
    const screen = await renderRow({ syncedLineCount: 38 });
    await expect.element(screen.getByRole("img", { name: "Synced" })).toBeInTheDocument();
  });

  it("names its checkbox and menu button after the project", async () => {
    const screen = await renderRow();
    await expect.element(screen.getByRole("checkbox", { name: "Select Midnight City" })).toBeInTheDocument();
    const menu = screen.getByRole("button", { name: "More actions for Midnight City" });
    await expect.element(menu).toHaveAttribute("aria-haspopup", "menu");
    await expect.element(menu).toHaveAttribute("aria-expanded", "false");
  });

  it("opens from the keyboard", async () => {
    const opened: string[] = [];
    await renderRow({}, (id) => opened.push(id));
    await userEvent.keyboard("{Tab}{Tab}{Enter}");
    expect(opened).toEqual(["p01"]);
  });

  describe("edge cases", () => {
    it("regression: styles a blank artist like a missing one", async () => {
      const missing = await renderRow({ artists: [] });
      const missingClass = missing.getByText("No artist").element().className;
      await missing.unmount();
      const blank = await renderRow({ artists: [""] });
      await expect.element(blank.getByText("No artist")).toBeInTheDocument();
      expect(blank.getByText("No artist").element().className).toBe(missingClass);
    });

    it("falls back for a missing artist, album, title and lyrics", async () => {
      const screen = await renderRow({ title: "", artists: [], album: "", lineCount: 0, syncedLineCount: 0 });
      await expect.element(screen.getByRole("button", { name: "Untitled", exact: true })).toBeInTheDocument();
      await expect.element(screen.getByText("No artist")).toBeInTheDocument();
      await expect.element(screen.getByText("No album")).toBeInTheDocument();
      await expect.element(screen.getByText("No lyrics yet")).toBeInTheDocument();
    });

    it("joins several artists", async () => {
      const screen = await renderRow({ artists: ["Lady Gaga", "Bruno Mars"] });
      await expect.element(screen.getByText("Lady Gaga, Bruno Mars")).toBeInTheDocument();
    });
  });

  describe("invariants", () => {
    it("marks its selected and menu states on the row for styling", async () => {
      const screen = await render(
        <ul>
          <ProjectRow
            project={indexEntry("p01")}
            now={NOW}
            isSelected
            isMenuOpen
            onOpen={() => {}}
            onToggleSelect={() => {}}
            onOpenMenu={() => {}}
          />
        </ul>,
      );
      const row = screen.container.querySelector("li");
      expect(row?.hasAttribute("data-selected")).toBe(true);
      expect(row?.hasAttribute("data-menu")).toBe(true);
      expect(row?.getAttribute("data-project-id")).toBe("p01");
    });

    it("does not re-read a sibling row's project when only one row's project changes", async () => {
      let readsA = 0;
      let readsB = 0;
      const projectB = countingIndexEntry("b", { title: "Bravo" }, () => {
        readsB += 1;
      });

      const Harness: React.FC = () => {
        const [, setRenderCount] = useState(0);
        return (
          <ul>
            <ProjectRow
              project={countingIndexEntry("a", { title: "Alpha" }, () => {
                readsA += 1;
              })}
              now={NOW}
              isSelected={false}
              isMenuOpen={false}
              onOpen={noop}
              onToggleSelect={noop}
              onOpenMenu={noop}
            />
            <ProjectRow
              project={projectB}
              now={NOW}
              isSelected={false}
              isMenuOpen={false}
              onOpen={noop}
              onToggleSelect={noop}
              onOpenMenu={noop}
            />
            <button type="button" onClick={() => setRenderCount((count) => count + 1)}>
              Rerender
            </button>
          </ul>
        );
      };

      const screen = await render(<Harness />);
      const rerenderButton = screen.getByRole("button", { name: "Rerender" });
      for (let round = 0; round < 20; round += 1) {
        await rerenderButton.click();
      }

      // memo's shallow compare never reads a prop's fields, so a genuine bailout never touches the getter again.
      expect(readsA).toBeGreaterThan(1);
      expect(readsB).toBe(1);
    });
  });
});

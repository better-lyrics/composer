import { HIT_TESTING_UTILITIES_CSS, POSITION_UTILITIES_CSS, installStyleSheet } from "@/test/browser-css";
import { countingIndexEntry, indexEntry } from "@/test/index-entries";
import { render } from "@/test/render";
import { ProjectCard } from "@/views/library/project-card";
import { useState } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Constants ----------------------------------------------------------------

const NOW = new Date(2026, 8, 27, 12, 0, 0).getTime();
const noop = () => {};

// -- Helpers ------------------------------------------------------------------

function renderCard(overrides: Parameters<typeof indexEntry>[1] = {}, onOpen: (id: string) => void = () => {}) {
  return render(
    <ul>
      <ProjectCard
        project={indexEntry("p02", {
          title: "Espresso",
          artists: ["Sabrina Carpenter"],
          lineCount: 52,
          syncedLineCount: 26,
          audioKind: "youtube",
          ...overrides,
        })}
        now={Date.now()}
        isSelected={false}
        isMenuOpen={false}
        onOpen={onOpen}
        onToggleSelect={() => {}}
        onOpenMenu={() => {}}
      />
    </ul>,
  );
}

// -- Tests --------------------------------------------------------------------

describe("ProjectCard", () => {
  it("shows the art, title, artist, bar, audio and percentage", async () => {
    const screen = await renderCard();
    await expect.element(screen.getByRole("listitem")).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Espresso", exact: true })).toBeInTheDocument();
    await expect.element(screen.getByText("Sabrina Carpenter")).toBeInTheDocument();
    await expect.element(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    await expect.element(screen.getByText("YouTube")).toBeInTheDocument();
    await expect.element(screen.getByText("50%")).toBeInTheDocument();
  });

  it("says Synced for a finished project", async () => {
    const screen = await renderCard({ syncedLineCount: 52 });
    await expect.element(screen.getByText("Synced")).toBeInTheDocument();
  });

  it("opens from the keyboard", async () => {
    const opened: string[] = [];
    await renderCard({}, (id) => opened.push(id));
    await userEvent.keyboard("{Tab}{Tab}{Tab}{Enter}");
    expect(opened).toEqual(["p02"]);
  });

  describe("edge cases", () => {
    it("regression: styles a blank artist like a missing one", async () => {
      const missing = await renderCard({ artists: [] });
      const missingClass = missing.getByText("No artist").element().className;
      await missing.unmount();
      const blank = await renderCard({ artists: [""] });
      await expect.element(blank.getByText("No artist")).toBeInTheDocument();
      expect(blank.getByText("No artist").element().className).toBe(missingClass);
    });

    it("says No lyrics for a project without lines", async () => {
      const screen = await renderCard({ lineCount: 0, syncedLineCount: 0 });
      await expect.element(screen.getByText("No lyrics")).toBeInTheDocument();
    });
  });

  describe("invariants", () => {
    it("does not re-read a sibling card's project when only one card's project changes", async () => {
      let readsA = 0;
      let readsB = 0;
      const projectB = countingIndexEntry("b", { title: "Bravo" }, () => {
        readsB += 1;
      });

      const Harness: React.FC = () => {
        const [, setRenderCount] = useState(0);
        return (
          <ul>
            <ProjectCard
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
            <ProjectCard
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

  describe("regressions", () => {
    const CARD_STACKING_REGRESSION_CSS = [
      ".top-2\\.5{top:0.625rem}",
      ".left-2\\.5{left:0.625rem}",
      ".top-2{top:0.5rem}",
      ".right-2{right:0.5rem}",
      '.after\\:absolute::after{content:"";position:absolute}',
      ".after\\:inset-0::after{inset:0px}",
      ".group\\/card:hover .group-hover\\/card\\:-translate-y-0\\.5{translate:0 -2px}",
    ].join("");

    let styles: HTMLStyleElement[] = [];
    beforeAll(() => {
      styles = [
        installStyleSheet(POSITION_UTILITIES_CSS),
        installStyleSheet(HIT_TESTING_UTILITIES_CSS),
        installStyleSheet(CARD_STACKING_REGRESSION_CSS),
      ];
    });
    afterAll(() => {
      for (const style of styles) style.remove();
    });

    it("regression: hovering the card still lets a real click reach the checkbox and menu button", async () => {
      const screen = await renderCard();
      await screen.getByRole("listitem").hover();

      const checkbox = screen.getByRole("checkbox").element();
      const menuButton = screen.getByRole("button", { name: /More actions/ }).element();
      const checkboxRect = checkbox.getBoundingClientRect();
      const menuRect = menuButton.getBoundingClientRect();
      const hitAtCheckbox = document.elementFromPoint(
        checkboxRect.left + checkboxRect.width / 2,
        checkboxRect.top + checkboxRect.height / 2,
      );
      const hitAtMenu = document.elementFromPoint(
        menuRect.left + menuRect.width / 2,
        menuRect.top + menuRect.height / 2,
      );

      expect(hitAtCheckbox === checkbox || Boolean(hitAtCheckbox && checkbox.contains(hitAtCheckbox))).toBe(true);
      expect(hitAtMenu === menuButton || Boolean(hitAtMenu && menuButton.contains(hitAtMenu))).toBe(true);
    });
  });
});

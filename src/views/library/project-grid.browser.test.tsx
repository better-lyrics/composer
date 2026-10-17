import { indexEntry } from "@/test/index-entries";
import { render } from "@/test/render";
import type { MenuAnchor } from "@/ui/menu";
import { ProjectGrid } from "@/views/library/project-grid";
import { describe, expect, it } from "vitest";

describe("ProjectGrid", () => {
  it("lays out every project as a card and passes interactions through", async () => {
    const opened: string[] = [];
    const menus: MenuAnchor["kind"][] = [];
    const toggled: string[] = [];
    const screen = await render(
      <ProjectGrid
        projects={[indexEntry("a", { title: "Alpha" }), indexEntry("b", { title: "Bravo" })]}
        now={Date.now()}
        selectedIds={new Set(["b"])}
        menuProjectId="b"
        onOpen={(id) => opened.push(id)}
        onToggleSelect={(id) => toggled.push(id)}
        onOpenMenu={(_id, anchor) => menus.push(anchor.kind)}
      />,
    );
    const grid = screen.getByRole("list", { name: "Projects" });
    await expect.element(grid).toHaveAttribute("data-selecting", "true");
    expect(grid.element().querySelectorAll("li")).toHaveLength(2);
    await expect
      .element(screen.getByRole("button", { name: "More actions for Bravo" }))
      .toHaveAttribute("aria-expanded", "true");
    await screen.getByRole("button", { name: "Alpha", exact: true }).click();
    await screen.getByRole("checkbox", { name: "Select Alpha" }).click();
    await screen.getByRole("button", { name: "Alpha", exact: true }).click({ button: "right" });
    expect(opened).toEqual(["a"]);
    expect(toggled).toEqual(["a"]);
    expect(menus).toEqual(["point"]);
  });

  describe("edge cases", () => {
    it("renders no cards for an empty project list", async () => {
      const screen = await render(
        <ProjectGrid
          projects={[]}
          now={Date.now()}
          selectedIds={new Set()}
          menuProjectId={null}
          onOpen={() => {}}
          onToggleSelect={() => {}}
          onOpenMenu={() => {}}
        />,
      );
      const grid = screen.getByRole("list", { name: "Projects" });
      await expect.element(grid).toBeInTheDocument();
      expect(grid.element().querySelectorAll("li")).toHaveLength(0);
    });
  });

  describe("invariants", () => {
    it("has no data-selecting when nothing is selected", async () => {
      const screen = await render(
        <ProjectGrid
          projects={[indexEntry("a", { title: "Alpha" })]}
          now={Date.now()}
          selectedIds={new Set()}
          menuProjectId={null}
          onOpen={() => {}}
          onToggleSelect={() => {}}
          onOpenMenu={() => {}}
        />,
      );
      await expect.element(screen.getByRole("list", { name: "Projects" })).toHaveAttribute("data-selecting", "false");
    });
  });
});

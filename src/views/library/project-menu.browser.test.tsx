import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { indexEntry } from "@/test/index-entries";
import { render } from "@/test/render";
import type { MenuAnchor } from "@/ui/menu";
import { ProjectMenu } from "@/views/library/project-menu";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

const HEAT_WAVES = indexEntry("p17", { title: "Heat Waves" });

const Harness: React.FC<{ project?: ProjectIndexEntry; calls: string[] }> = ({ project = HEAT_WAVES, calls }) => {
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  return (
    <>
      <button type="button" onClick={(event) => setAnchor({ kind: "element", element: event.currentTarget })}>
        More
      </button>
      {anchor && (
        <ProjectMenu
          project={project}
          anchor={anchor}
          onClose={() => setAnchor(null)}
          onOpen={(id) => calls.push(`open ${id}`)}
          onRename={(project) => calls.push(`rename ${project.id}`)}
          onDuplicate={(id) => calls.push(`duplicate ${id}`)}
          onExport={(id) => calls.push(`export ${id}`)}
          onDelete={(project) => calls.push(`delete ${project.id}`)}
        />
      )}
    </>
  );
};

// -- Tests --------------------------------------------------------------------

describe("ProjectMenu", () => {
  it("lists the project actions in order", async () => {
    const screen = await render(<Harness calls={[]} />);
    await screen.getByRole("button", { name: "More" }).click();
    const menu = screen.getByRole("menu", { name: "Actions for Heat Waves" });
    const labels = [...menu.element().querySelectorAll("[role='menuitem']")].map((item) => item.textContent);
    expect(labels).toEqual(["Open", "Rename", "Duplicate", "Export project file", "Delete⌫"]);
  });

  it("runs each action and closes", async () => {
    const calls: string[] = [];
    const screen = await render(<Harness calls={calls} />);
    for (const label of ["Open", "Rename", "Duplicate", "Export project file", "Delete"]) {
      await screen.getByRole("button", { name: "More" }).click();
      await screen.getByRole("menuitem", { name: label }).click();
      await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
    }
    expect(calls).toEqual(["open p17", "rename p17", "duplicate p17", "export p17", "delete p17"]);
  });

  it("deletes from the keyboard", async () => {
    const calls: string[] = [];
    const screen = await render(<Harness calls={calls} />);
    await screen.getByRole("button", { name: "More" }).click();
    await userEvent.keyboard("{ArrowUp}{Enter}");
    expect(calls).toEqual(["delete p17"]);
  });

  describe("edge cases", () => {
    it("names the menu after an untitled project", async () => {
      const untitled = indexEntry("p18", { title: "" });
      const screen = await render(<Harness project={untitled} calls={[]} />);
      await screen.getByRole("button", { name: "More" }).click();
      await expect.element(screen.getByRole("menu", { name: "Actions for Untitled" })).toBeInTheDocument();
    });
  });
});

import type { MenuAnchor } from "@/ui/menu";
import { indexEntry } from "@/test/index-entries";
import { render } from "@/test/render";
import { ProjectList, ProjectListColumns } from "@/views/library/project-list";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

const PROJECTS = [indexEntry("a", { title: "Alpha" }), indexEntry("b", { title: "Bravo" })];

interface Calls {
  opened: string[];
  toggled: [string, boolean][];
  menus: [string, MenuAnchor["kind"]][];
}

function renderList(calls: Calls, selectedIds: ReadonlySet<string> = new Set()) {
  return render(
    <ProjectList
      projects={PROJECTS}
      now={Date.now()}
      selectedIds={selectedIds}
      menuProjectId={null}
      onOpen={(id) => calls.opened.push(id)}
      onToggleSelect={(id, range) => calls.toggled.push([id, range])}
      onOpenMenu={(id, anchor) => calls.menus.push([id, anchor.kind])}
    />,
  );
}

function noCalls(): Calls {
  return { opened: [], toggled: [], menus: [] };
}

// -- Tests --------------------------------------------------------------------

describe("ProjectList", () => {
  it("lists every project in order", async () => {
    const screen = await renderList(noCalls());
    const list = screen.getByRole("list", { name: "Projects" });
    await expect.element(list).toBeInTheDocument();
    expect([...list.element().querySelectorAll("li")].map((row) => row.dataset.projectId)).toEqual(["a", "b"]);
  });

  it("opens a project from its title", async () => {
    const calls = noCalls();
    const screen = await renderList(calls);
    await screen.getByRole("button", { name: "Bravo", exact: true }).click();
    expect(calls.opened).toEqual(["b"]);
  });

  it("toggles selection, with shift for a range", async () => {
    const calls = noCalls();
    const screen = await renderList(calls);
    await screen.getByRole("checkbox", { name: "Select Alpha" }).click();
    await userEvent.keyboard("{Shift>}");
    await screen.getByRole("checkbox", { name: "Select Bravo" }).click();
    await userEvent.keyboard("{/Shift}");
    expect(calls.toggled).toEqual([
      ["a", false],
      ["b", true],
    ]);
  });

  it("opens the menu from the button or a right click", async () => {
    const calls = noCalls();
    const screen = await renderList(calls);
    await screen.getByRole("button", { name: "More actions for Alpha" }).click();
    await screen.getByRole("button", { name: "Bravo", exact: true }).click({ button: "right" });
    expect(calls.menus).toEqual([
      ["a", "element"],
      ["b", "point"],
    ]);
  });

  it("opens a project from the keyboard", async () => {
    const calls = noCalls();
    await renderList(calls);
    await userEvent.keyboard("{Tab}{Tab}{Enter}");
    expect(calls.opened).toEqual(["a"]);
  });

  it("flags when anything is selected so every row shows its checkbox", async () => {
    const screen = await renderList(noCalls(), new Set(["a"]));
    await expect.element(screen.getByRole("list", { name: "Projects" })).toHaveAttribute("data-selecting", "true");
    await expect.element(screen.getByRole("checkbox", { name: "Select Alpha" })).toBeChecked();
  });
});

describe("ProjectListColumns", () => {
  it("labels the columns and stays out of the accessibility tree", async () => {
    const screen = await render(<ProjectListColumns />);
    const header = screen.container.firstElementChild;
    expect(header?.getAttribute("aria-hidden")).toBe("true");
    expect(header?.textContent).toBe("TitleAlbumProgressAudioEdited");
  });
});

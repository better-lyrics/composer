import { describe, expect, it, vi } from "vitest";
import type { LibraryProject } from "@/domain/project/library-project";
import { putLibraryProject } from "@/lib/library-persistence";
import { LibraryPage } from "@/pages/library/library-page";
import { render } from "@/test/render";

// -- Helpers ------------------------------------------------------------------

function makeProject(overrides: Partial<LibraryProject> & Pick<LibraryProject, "id">): LibraryProject {
  return {
    version: 1,
    metadata: { title: `Title-${overrides.id}`, artist: "Artist", album: "", duration: 100 },
    agents: [],
    lines: [],
    groups: [],
    granularity: "word",
    syllableSplitDefaults: { applyToAll: false, caseInsensitive: false },
    audioBytesCached: false,
    dismissedSuggestions: [],
    dismissedExplicitSuggestions: [],
    currentStem: "original",
    createdAt: 0,
    updatedAt: 0,
    lastOpenedAt: 1,
    ...overrides,
  };
}

const noop = () => {};

// -- Tests --------------------------------------------------------------------

describe("LibraryPage", () => {
  it("shows the empty state when there are no projects", async () => {
    const screen = await render(<LibraryPage onOpenProject={noop} onNewProject={noop} />);
    await expect.element(screen.getByText("Drop an audio file to start")).toBeInTheDocument();
    await expect.element(screen.getByText(/No account needed/)).toBeInTheDocument();
  });

  it("renders all pinned projects in the Pinned section", async () => {
    await putLibraryProject(makeProject({ id: "pin-a", lastOpenedAt: 10, pinned: true }));
    await putLibraryProject(makeProject({ id: "pin-b", lastOpenedAt: 20, pinned: true }));
    await putLibraryProject(makeProject({ id: "loose-c", lastOpenedAt: 30 }));

    const screen = await render(<LibraryPage onOpenProject={noop} onNewProject={noop} />);

    await expect.element(screen.getByText("Title-pin-a")).toBeInTheDocument();
    await expect.element(screen.getByText("Title-pin-b")).toBeInTheDocument();

    const pinnedHeading = screen.container.querySelector("section[aria-labelledby='library-pinned-heading']");
    expect(pinnedHeading).not.toBeNull();
    const pinnedCards = pinnedHeading?.querySelectorAll("button");
    const pinnedTitles = Array.from(pinnedCards ?? [])
      .map((b) => b.textContent ?? "")
      .filter((t) => t.includes("Title-"));
    expect(pinnedTitles.length).toBe(2);
    expect(pinnedTitles.some((t) => t.includes("Title-pin-a"))).toBe(true);
    expect(pinnedTitles.some((t) => t.includes("Title-pin-b"))).toBe(true);
    expect(pinnedTitles.every((t) => !t.includes("Title-loose-c"))).toBe(true);
  });

  it("calls onOpenProject when a project card is clicked", async () => {
    await putLibraryProject(makeProject({ id: "clickme", lastOpenedAt: 100 }));
    const onOpen = vi.fn();
    const screen = await render(<LibraryPage onOpenProject={onOpen} onNewProject={noop} />);
    await screen.getByRole("button", { name: /Title-clickme/ }).click();
    expect(onOpen).toHaveBeenCalledWith("clickme");
  });

  it("calls onNewProject when the new project card is clicked", async () => {
    await putLibraryProject(makeProject({ id: "any", lastOpenedAt: 100 }));
    const onNew = vi.fn();
    const screen = await render(<LibraryPage onOpenProject={noop} onNewProject={onNew} />);
    await screen.getByRole("button", { name: /New project/ }).click();
    expect(onNew).toHaveBeenCalled();
  });

  it("calls onOpenSearch when the search box is clicked", async () => {
    await putLibraryProject(makeProject({ id: "any2", lastOpenedAt: 100 }));
    const onSearch = vi.fn();
    const screen = await render(<LibraryPage onOpenProject={noop} onNewProject={noop} onOpenSearch={onSearch} />);
    await screen.getByRole("button", { name: /Search projects/ }).click();
    expect(onSearch).toHaveBeenCalled();
  });

  it("calls onNewProject from the empty-state button", async () => {
    const onNew = vi.fn();
    const screen = await render(<LibraryPage onOpenProject={noop} onNewProject={onNew} />);
    await screen.getByRole("button", { name: /New project/ }).click();
    expect(onNew).toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { App, AppViewSwitch } from "@/App";
import type { LibraryProject } from "@/domain/project/library-project";
import { putLibraryProject } from "@/lib/library-persistence";
import { useProjectStore } from "@/stores/project";
import { useUIStore } from "@/stores/ui";
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

describe("AppViewSwitch", () => {
  it("renders the LibraryPage when showLibrary is true", async () => {
    const screen = await render(
      <AppViewSwitch showLibrary={true} activeTab="import" onOpenProject={noop} onExitLibrary={noop} />,
    );
    await expect.element(screen.getByText(/Drop an audio file to start|Your library/)).toBeInTheDocument();
  });

  it("renders the in-project shell when showLibrary is false", async () => {
    useProjectStore.setState({ activeTab: "import" });
    const screen = await render(
      <AppViewSwitch showLibrary={false} activeTab="import" onOpenProject={noop} onExitLibrary={noop} />,
    );
    expect(screen.container.querySelector("nav")).not.toBeNull();
  });

  it("calls onOpenProject when a library card is clicked", async () => {
    await putLibraryProject(makeProject({ id: "open-me", lastOpenedAt: 100 }));
    const onOpen = vi.fn();
    const screen = await render(
      <AppViewSwitch showLibrary={true} activeTab="import" onOpenProject={onOpen} onExitLibrary={noop} />,
    );
    await screen.getByRole("button", { name: /Title-open-me/ }).click();
    expect(onOpen).toHaveBeenCalledWith("open-me");
  });

  it("calls onExitLibrary when the new project card is clicked", async () => {
    await putLibraryProject(makeProject({ id: "any", lastOpenedAt: 100 }));
    const onExit = vi.fn();
    const screen = await render(
      <AppViewSwitch showLibrary={true} activeTab="import" onOpenProject={noop} onExitLibrary={onExit} />,
    );
    await screen.getByRole("button", { name: /New project/ }).click();
    expect(onExit).toHaveBeenCalled();
  });

  it("preserves the in-project shell in the DOM while the library is visible", async () => {
    useProjectStore.setState({ activeTab: "import" });
    const screen = await render(
      <AppViewSwitch showLibrary={true} activeTab="import" onOpenProject={noop} onExitLibrary={noop} />,
    );
    expect(screen.container.querySelector("nav")).not.toBeNull();
  });

  it("keeps the library mounted while the in-project shell is visible", async () => {
    await putLibraryProject(makeProject({ id: "kept", lastOpenedAt: 5 }));
    const screen = await render(
      <AppViewSwitch showLibrary={false} activeTab="import" onOpenProject={noop} onExitLibrary={noop} />,
    );
    await expect.poll(() => screen.container.textContent ?? "").toContain("Your library");
  });
});

describe("App", () => {
  it("renders the app header and tab bar when an active project exists", async () => {
    localStorage.setItem("composer-tour-seen", "true");
    await putLibraryProject(makeProject({ id: "seeded", lastOpenedAt: 100 }));
    useProjectStore.setState({ activeTab: "import", activeProjectId: "seeded" });
    useUIStore.setState({ viewingLibrary: false });
    const screen = await render(<App />);
    expect(screen.container.textContent).toContain("Composer");
    await expect.poll(() => screen.container.querySelector("nav")).not.toBeNull();
  });

  it("switches the active tab when a tab button is clicked", async () => {
    localStorage.setItem("composer-tour-seen", "true");
    await putLibraryProject(makeProject({ id: "seeded-2", lastOpenedAt: 100 }));
    useProjectStore.setState({ activeTab: "import", activeProjectId: "seeded-2" });
    useUIStore.setState({ viewingLibrary: false });
    const screen = await render(<App />);
    await expect.poll(() => screen.container.querySelector('[data-tour="tab-edit"]')).not.toBeNull();
    const editButton = screen.container.querySelector('[data-tour="tab-edit"]') as HTMLButtonElement;
    editButton.click();
    await expect.poll(() => useProjectStore.getState().activeTab).toBe("edit");
  });

  it("shows the LibraryPage when no active project is set", async () => {
    localStorage.setItem("composer-tour-seen", "true");
    useProjectStore.setState({ activeProjectId: undefined });
    useUIStore.setState({ viewingLibrary: true });
    const screen = await render(<App />);
    await expect.poll(() => screen.container.textContent ?? "").toMatch(/Drop an audio file to start|Your library/);
  });
});

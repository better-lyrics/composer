import { beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { App } from "@/App";
import { deleteProject } from "@/lib/open-project";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { allowConsole } from "@/test/console-guard";
import { LocationProbe } from "@/test/location-probe";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { TOUR_SEEN_KEY } from "@/tour/use-tour";
import { isMac } from "@/utils/platform";

// -- Helpers ------------------------------------------------------------------

function renderApp(path: string) {
  return render(
    <>
      <App />
      <LocationProbe />
    </>,
    { withRouter: { initialEntries: [path] } },
  );
}

function tabBarVisible(): boolean {
  const tab = document.querySelector<HTMLElement>('[data-tour="tab-edit"]');
  return tab?.checkVisibility() ?? false;
}

beforeEach(async () => {
  localStorage.setItem(TOUR_SEEN_KEY, "true");
  allowConsole(/cannot be a descendant of/);
  allowConsole(/cannot contain a nested/);
  allowConsole(/WebGL is not available/);
  await seedStoredProject("alpha", { project: songTitled("Alpha") });
});

// -- Tests --------------------------------------------------------------------

describe("App screens", () => {
  it("shows the library at / with the editor hidden", async () => {
    const screen = await renderApp("/");
    await expect.element(screen.getByRole("heading", { name: "Projects 1" })).toBeInTheDocument();
    expect(tabBarVisible()).toBe(false);
    expect(document.title).toBe("Composer ・ Projects");
  });

  it("opens a project from the library in the editor", async () => {
    const screen = await renderApp("/");
    await screen.getByRole("button", { name: "Alpha", exact: true }).click();
    await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent("/editor");
    await expect.element(screen.getByRole("button", { name: "Alpha, switch project" })).toBeInTheDocument();
    expect(tabBarVisible()).toBe(true);
  });

  it("the Projects crumb goes home and pauses playback", async () => {
    const screen = await renderApp("/editor");
    useAudioStore.getState().setIsPlaying(true);
    await screen.getByRole("link", { name: "Projects" }).click();
    await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent(/^\/$/);
    await expect.poll(() => useAudioStore.getState().isPlaying).toBe(false);
    await expect.element(screen.getByRole("heading", { name: "Projects 1" })).toBeInTheDocument();
  });

  it("keeps editor shortcuts off in the library", async () => {
    useProjectStore.setState({ activeTab: "import" });
    const screen = await renderApp("/");
    await expect.element(screen.getByRole("heading", { name: "Projects 1" })).toBeInTheDocument();
    await userEvent.keyboard(isMac ? "{Meta>}2{/Meta}" : "{Control>}2{/Control}");
    expect(useProjectStore.getState().activeTab).toBe("import");
  });

  it("Mod+O focuses the library search instead of opening the switcher", async () => {
    const screen = await renderApp("/");
    await expect.element(screen.getByRole("heading", { name: "Projects 1" })).toBeInTheDocument();
    await userEvent.keyboard(isMac ? "{Meta>}o{/Meta}" : "{Control>}o{/Control}");
    await expect.element(screen.getByRole("textbox", { name: "Search projects" })).toHaveFocus();
    await expect.element(screen.getByRole("dialog", { name: "Switch project" })).not.toBeInTheDocument();
  });

  it("the tour button in the library opens the editor", async () => {
    const screen = await renderApp("/");
    await screen.getByRole("button", { name: "Product tour" }).click();
    await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent("/editor");
  });

  describe("edge cases", () => {
    it("first run at / lands on the editor", async () => {
      await deleteProject("alpha");
      const screen = await renderApp("/");
      await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent("/editor");
      await expect.poll(tabBarVisible).toBe(true);
    });

    it("the Projects crumb shows the empty library when there are no projects", async () => {
      await deleteProject("alpha");
      const screen = await renderApp("/editor");
      await screen.getByRole("link", { name: "Projects" }).click();
      await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent(/^\/$/);
      await expect.element(screen.getByText("Start a new song above.")).toBeVisible();
      expect(screen.getByRole("status", { name: "Current path" }).element().textContent).toBe("/");
    });
  });

  describe("regressions", () => {
    it("regression: returning to the library keeps the loaded projects on screen", async () => {
      const screen = await renderApp("/");
      const resume = screen.getByRole("region", { name: "Alpha" });
      await expect.element(resume).toBeInTheDocument();
      const resumeNode = resume.element();
      await screen.getByRole("button", { name: "Alpha", exact: true }).click();
      await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent("/editor");
      await screen.getByRole("link", { name: "Projects" }).click();
      await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent(/^\/$/);
      expect(document.querySelectorAll("[data-project-id]")).toHaveLength(1);
      expect(resume.element()).toBe(resumeNode);
    });
  });
});

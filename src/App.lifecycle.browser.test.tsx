import { App } from "@/App";
import { loadProjectRecord } from "@/lib/project-storage";
import { useUIStore } from "@/stores/ui";
import { allowConsole } from "@/test/console-guard";
import { LocationProbe } from "@/test/location-probe";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { TOUR_SEEN_KEY } from "@/tour/use-tour";
import { isMac } from "@/utils/platform";
import { useEffect } from "react";
import { type NavigateFunction, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Constants ----------------------------------------------------------------

const PAST_TOUR_DELAY_MS = 1_000;

// -- Helpers ------------------------------------------------------------------

let navigateInApp: NavigateFunction | null = null;

const NavigationHandle: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigateInApp = navigate;
    return () => {
      navigateInApp = null;
    };
  }, [navigate]);
  return null;
};

function renderApp(initialEntries: string[], initialIndex = initialEntries.length - 1) {
  return render(
    <>
      <App />
      <LocationProbe />
      <NavigationHandle />
    </>,
    { withRouter: { initialEntries, initialIndex } },
  );
}

function goBack(): void {
  if (!navigateInApp) throw new Error("the router is not mounted");
  void navigateInApp(-1);
}

function tourPopover(): Element | null {
  return document.querySelector(".driver-popover");
}

function modO(): Promise<void> {
  return userEvent.keyboard(isMac ? "{Meta>}o{/Meta}" : "{Control>}o{/Control}");
}

beforeEach(async () => {
  localStorage.setItem(TOUR_SEEN_KEY, "true");
  allowConsole(/cannot be a descendant of/);
  allowConsole(/cannot contain a nested/);
  allowConsole(/WebGL is not available/);
  await seedStoredProject("alpha", { open: true, project: songTitled("Alpha") });
});

// -- Tests --------------------------------------------------------------------

describe("App lifecycle", () => {
  describe("tour requests", () => {
    it("the library tour button starts the tour in the editor", async () => {
      const screen = await renderApp(["/"]);
      await screen.getByRole("button", { name: "Product tour" }).click();
      await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent("/editor");
      await expect.poll(tourPopover, { timeout: 3_000 }).not.toBeNull();
    });

    it("regression: leaving the editor before the tour starts drops the request", async () => {
      const screen = await renderApp(["/"]);
      await screen.getByRole("button", { name: "Product tour" }).click();
      await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent("/editor");
      await screen.getByRole("link", { name: "Projects" }).click();
      await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent(/^\/$/);
      await screen.getByRole("button", { name: "Alpha", exact: true }).click();
      await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent("/editor");
      await new Promise((resolve) => setTimeout(resolve, PAST_TOUR_DELAY_MS));
      expect(tourPopover()).toBeNull();
    });
  });

  describe("project switcher", () => {
    it("regression: going Back out of the editor closes the switcher", async () => {
      const screen = await renderApp(["/", "/editor"]);
      await expect.element(screen.getByRole("button", { name: "Alpha, switch project" })).toBeInTheDocument();
      await modO();
      await expect.element(screen.getByRole("dialog", { name: "Switch project" })).toBeInTheDocument();
      goBack();
      await expect.element(screen.getByRole("status", { name: "Current path" })).toHaveTextContent(/^\/$/);
      await expect.poll(() => useUIStore.getState().projectSwitcherOpen).toBe(false);
    });
  });

  describe("keyboard", () => {
    it("Mod+O in the editor opens the switcher and leaves the hidden library search alone", async () => {
      const screen = await renderApp(["/editor"]);
      await expect.element(screen.getByRole("button", { name: "Alpha, switch project" })).toBeInTheDocument();
      await modO();
      await expect.element(screen.getByRole("dialog", { name: "Switch project" })).toBeInTheDocument();
      await expect.element(screen.getByRole("combobox", { name: "Search projects" })).toHaveFocus();
      await userEvent.keyboard("{Escape}");
      await expect.element(screen.getByRole("dialog", { name: "Switch project" })).not.toBeInTheDocument();
    });
  });

  describe("unmount", () => {
    it("regression: commits a pending delete when the app goes away", async () => {
      const screen = await renderApp(["/"]);
      await screen.getByRole("button", { name: "More actions for Alpha" }).click();
      await screen.getByRole("menuitem", { name: "Delete" }).click();
      await expect.element(screen.getByText("Deleted “Alpha”")).toBeInTheDocument();
      await screen.unmount();
      await expect.poll(() => loadProjectRecord("alpha")).toBeUndefined();
    });
  });
});

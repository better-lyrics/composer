import { App } from "@/App";
import { removeProjectData } from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import { getSaveStatus } from "@/lib/save-status";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { assignBinding } from "@/stores/shortcut-bindings";
import { allowConsole } from "@/test/console-guard";
import { LocationProbe } from "@/test/location-probe";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { TOUR_SEEN_KEY } from "@/tour/use-tour";
import { isMac } from "@/utils/platform";
import { beforeEach, describe, expect, it } from "vitest";

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

function pressSave(target: EventTarget, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: "s",
    code: "KeyS",
    metaKey: isMac,
    ctrlKey: !isMac,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

async function openEditTab(screen: Awaited<ReturnType<typeof renderApp>>): Promise<HTMLTextAreaElement> {
  await expect.element(screen.getByRole("button", { name: "Alpha, switch project" })).toBeInTheDocument();
  useProjectStore.getState().setActiveTab("edit");
  const lyrics = screen.getByRole("textbox", { name: "Paste or type lyrics" });
  await lyrics.fill("Typed before the delay");
  await expect
    .poll(() => useProjectStore.getState().lines.map((line) => line.text))
    .toContain("Typed before the delay");
  return lyrics.element() as HTMLTextAreaElement;
}

async function storedLineTexts(): Promise<string[]> {
  return ((await loadProjectRecord("alpha"))?.lines ?? []).map((line) => line.text);
}

beforeEach(async () => {
  localStorage.setItem(TOUR_SEEN_KEY, "true");
  allowConsole(/cannot be a descendant of/);
  allowConsole(/cannot contain a nested/);
  allowConsole(/WebGL is not available/);
  useSettingsStore.setState({ autoSaveDelay: 60_000 });
  await seedStoredProject("alpha", { open: true, project: songTitled("Alpha") });
});

// -- Tests --------------------------------------------------------------------

describe("Save shortcut", () => {
  it("saves the open project at once from the Edit textarea and keeps the browser dialog away", async () => {
    const screen = await renderApp("/editor");
    const lyrics = await openEditTab(screen);
    expect(await storedLineTexts()).not.toContain("Typed before the delay");
    const event = pressSave(lyrics);
    expect(event.defaultPrevented).toBe(true);
    await expect.poll(storedLineTexts).toContain("Typed before the delay");
  });

  it("does nothing in the library but keep the browser dialog away", async () => {
    const screen = await renderApp("/");
    await expect.element(screen.getByRole("heading", { name: "Projects 1" })).toBeInTheDocument();
    const before = await loadProjectRecord("alpha");
    const event = pressSave(document.body);
    expect(event.defaultPrevented).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await loadProjectRecord("alpha")).toEqual(before);
  });

  describe("error paths", () => {
    it("shows the failed save status when the write is refused", async () => {
      allowConsole(/could not save the project|Auto-save failed|Flush save failed/);
      const screen = await renderApp("/editor");
      const lyrics = await openEditTab(screen);
      await removeProjectData("alpha");
      expect(pressSave(lyrics).defaultPrevented).toBe(true);
      await expect.poll(getSaveStatus).toBe("failed");
      expect(await loadProjectRecord("alpha")).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("keeps the browser dialog away on a held key without saving again", async () => {
      const screen = await renderApp("/editor");
      const lyrics = await openEditTab(screen);
      const event = pressSave(lyrics, { repeat: true });
      expect(event.defaultPrevented).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(await storedLineTexts()).not.toContain("Typed before the delay");
    });

    it("follows a remapped binding and frees the old one", async () => {
      assignBinding("global.saveNow", { key: "k", mod: true, shift: true });
      const screen = await renderApp("/editor");
      const lyrics = await openEditTab(screen);
      expect(pressSave(lyrics).defaultPrevented).toBe(false);
      const event = pressSave(lyrics, { key: "k", code: "KeyK", shiftKey: true });
      expect(event.defaultPrevented).toBe(true);
      await expect.poll(storedLineTexts).toContain("Typed before the delay");
    });
  });
});

import { listProjectIndex } from "@/lib/project-repository";
import { useSettingsStore } from "@/stores/settings";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { SettingsSectionRows } from "@/ui/settings/settings-section-rows";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

function setRangeValue(input: HTMLInputElement, value: number): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, String(value));
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function renderStorage() {
  return render(
    <>
      <SettingsSectionRows section="storage" />
      <ConfirmModalHost />
      <Toaster />
    </>,
  );
}

// -- Tests --------------------------------------------------------------------

describe("SettingsSectionRows (storage)", () => {
  it("shows the formatted auto-save delay", async () => {
    useSettingsStore.setState({ autoSaveDelay: 2000 });
    const screen = await render(<SettingsSectionRows section="storage" />);
    await expect.element(screen.getByText("2.0s")).toBeInTheDocument();
  });

  it("writes a new auto-save delay to the store on change", async () => {
    const screen = await render(<SettingsSectionRows section="storage" />);
    setRangeValue(screen.getByRole("slider").element() as HTMLInputElement, 5000);
    await expect.poll(() => useSettingsStore.getState().autoSaveDelay).toBe(5000);
  });

  it("shows the Usage, Audio and Saving groups", async () => {
    const screen = await render(<SettingsSectionRows section="storage" />);
    for (const title of ["Usage", "Audio", "Saving"]) {
      await expect.element(screen.getByRole("region", { name: title })).toBeInTheDocument();
    }
  });

  it("wraps the usage panel and the protection notice in a Usage group", async () => {
    const screen = await render(<SettingsSectionRows section="storage" />);
    const usageGroup = screen.getByRole("region", { name: "Usage" });
    await expect.element(usageGroup).toBeInTheDocument();
    await expect.element(usageGroup.getByText("used on this device")).toBeInTheDocument();
  });

  it("wraps the auto-save delay row in the Saving group", async () => {
    const screen = await render(<SettingsSectionRows section="storage" />);
    const autoSaveRow = screen.container.querySelector('[data-setting-id="autoSaveDelay"]');
    expect(autoSaveRow?.closest("section")).toBe(screen.getByRole("region", { name: "Saving" }).element());
  });

  describe("Audio group", () => {
    it("wraps the audio rows in an Audio group", async () => {
      const screen = await render(<SettingsSectionRows section="storage" />);
      const audioGroup = screen.getByRole("region", { name: "Audio" });
      await expect.element(audioGroup).toBeInTheDocument();
      await expect.element(audioGroup.getByRole("button", { name: "Keep YouTube audio" })).toBeInTheDocument();
    });

    it("mounts audio by project in the Audio group, after the storage rows", async () => {
      const screen = await render(<SettingsSectionRows section="storage" />);
      const audioGroup = screen.getByRole("region", { name: "Audio" });
      await expect.element(audioGroup.getByText("Audio by project")).toBeInTheDocument();
      const ids = Array.from(screen.container.querySelectorAll("[data-setting-id]")).map((el) =>
        el.getAttribute("data-setting-id"),
      );
      expect(ids.indexOf("storageLimit")).toBeGreaterThanOrEqual(0);
      expect(ids.indexOf("projectAudioList")).toBeGreaterThan(ids.indexOf("storageLimit"));
    });

    it("describes Automatic by whether Composer Bridge is on", async () => {
      const screen = await render(<SettingsSectionRows section="storage" />);
      await expect
        .element(screen.getByText("Composer Bridge is off, so YouTube audio is kept. Fetching it again can fail."))
        .toBeInTheDocument();
      useSettingsStore.setState({ experiments: { youtubeBridge: true } });
      await expect
        .element(
          screen.getByText("Composer Bridge is on, so YouTube audio is fetched when you open a project and not kept."),
        )
        .toBeInTheDocument();
    });

    it("picks Never and describes it", async () => {
      const screen = await render(<SettingsSectionRows section="storage" />);
      await screen.getByRole("button", { name: "Keep YouTube audio" }).click();
      await screen.getByRole("option", { name: "Never" }).click();
      expect(useSettingsStore.getState().keepYouTubeAudio).toBe("never");
      await expect
        .element(screen.getByText("YouTube audio is fetched each time you open a project."))
        .toBeInTheDocument();
    });

    it("describes Always", async () => {
      useSettingsStore.setState({ keepYouTubeAudio: "always" });
      const screen = await render(<SettingsSectionRows section="storage" />);
      await expect
        .element(screen.getByText("YouTube audio is kept, so projects open offline. Cleanup can still remove it."))
        .toBeInTheDocument();
    });

    it("turns Smart cleanup off and hides the limit", async () => {
      const screen = await render(<SettingsSectionRows section="storage" />);
      await expect.element(screen.getByRole("button", { name: "Storage limit" })).toBeInTheDocument();
      await screen.getByRole("switch", { name: "Smart cleanup" }).click();
      expect(useSettingsStore.getState().smartCleanup).toBe(false);
      expect(screen.getByRole("button", { name: "Storage limit" }).elements()).toHaveLength(0);
    });

    it("picks a storage limit from the keyboard", async () => {
      const screen = await render(<SettingsSectionRows section="storage" />);
      screen.getByRole("button", { name: "Storage limit" }).element().focus();
      await userEvent.keyboard("{Enter}");
      await expect.element(screen.getByRole("option", { name: "No limit" })).toBeInTheDocument();
      await screen.getByRole("option", { name: "No limit" }).click();
      expect(useSettingsStore.getState().storageLimit).toBe("none");
    });

    describe("edge cases", () => {
      it("shows every limit choice and the cleanup description", async () => {
        const screen = await render(<SettingsSectionRows section="storage" />);
        await expect
          .element(
            screen.getByText(
              "When space runs low or you pass the limit, remove vocal stems first, then YouTube audio you haven't opened in a while. Local files and the open project are never removed.",
            ),
          )
          .toBeInTheDocument();
        await expect.element(screen.getByText("Cleanup starts above this size.")).toBeInTheDocument();
        await screen.getByRole("button", { name: "Storage limit" }).click();
        for (const label of ["1 GB", "2 GB", "5 GB", "No limit"]) {
          await expect.element(screen.getByRole("option", { name: label })).toBeInTheDocument();
        }
      });
    });
  });

  describe("Saving group", () => {
    it("wraps the auto-save delay, backup and delete-all rows in a Saving group, in order", async () => {
      const screen = await renderStorage();
      const savingGroup = screen.getByRole("region", { name: "Saving" });
      await expect.element(savingGroup.getByRole("button", { name: "Export all" })).toBeInTheDocument();
      await expect.element(savingGroup.getByRole("button", { name: "Delete all" })).toBeInTheDocument();
      const ids = Array.from(screen.container.querySelectorAll("[data-setting-id]")).map((el) =>
        el.getAttribute("data-setting-id"),
      );
      expect(ids.indexOf("autoSaveDelay")).toBeGreaterThanOrEqual(0);
      expect(ids.indexOf("backUpAllProjects")).toBeGreaterThan(ids.indexOf("autoSaveDelay"));
      expect(ids.indexOf("deleteAllProjects")).toBeGreaterThan(ids.indexOf("backUpAllProjects"));
    });

    it("deletes every project through the real Settings rows after confirming", async () => {
      await seedStoredProject("a", { project: songTitled("Alpha") });
      const screen = await renderStorage();
      await screen.getByRole("button", { name: "Delete all" }).click();
      await screen.getByRole("dialog").getByRole("button", { name: "Delete all" }).click();
      await expect.poll(listProjectIndex).toEqual([]);
      await expect.element(screen.getByText("Deleted all projects")).toBeInTheDocument();
    });
  });
});

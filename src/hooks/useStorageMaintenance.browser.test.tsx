import { listStemJobs, putStem } from "@/audio/separation/stem-store";
import { useStorageMaintenance } from "@/hooks/useStorageMaintenance";
import { markPersistenceSettled } from "@/lib/persistence-settled";
import { notifyStorageSignal } from "@/lib/storage-signals";
import { useSettingsStore } from "@/stores/settings";
import { useUIStore } from "@/stores/ui";
import { sleep } from "@/test/async";
import { render } from "@/test/render";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const MaintenanceHost: React.FC = () => {
  useStorageMaintenance();
  return <Toaster />;
};

async function seedStems(): Promise<void> {
  await putStem("h1", "vocals", "fp32", new Blob([new Uint8Array(2048)]));
}

// -- Tests --------------------------------------------------------------------

describe("useStorageMaintenance", () => {
  it("cleans up at once when storage is full and says what it freed", async () => {
    await seedStems();
    markPersistenceSettled();
    const screen = await render(<MaintenanceHost />);
    notifyStorageSignal("storage-full");
    await expect.poll(listStemJobs).toEqual([]);
    await expect.element(screen.getByText("Storage is full")).toBeInTheDocument();
    await expect
      .element(
        screen.getByText("Freed 2.0 KB by removing vocal stems and YouTube audio you haven't opened in a while."),
      )
      .toBeInTheDocument();
  });

  it("coalesces a burst of storage-full signals so a later zero result never replaces the freed-bytes toast", async () => {
    await seedStems();
    markPersistenceSettled();
    const screen = await render(<MaintenanceHost />);
    notifyStorageSignal("storage-full");
    notifyStorageSignal("storage-full");
    notifyStorageSignal("storage-full");
    await expect.poll(listStemJobs).toEqual([]);
    await expect
      .element(
        screen.getByText("Freed 2.0 KB by removing vocal stems and YouTube audio you haven't opened in a while."),
      )
      .toBeInTheDocument();
    await sleep(200);
    await expect
      .element(screen.getByText("Remove audio you don't need so Composer can keep saving."))
      .not.toBeInTheDocument();
  });

  it("opens Save & Storage from the toast", async () => {
    await seedStems();
    markPersistenceSettled();
    const screen = await render(<MaintenanceHost />);
    notifyStorageSignal("storage-full");
    await screen.getByRole("button", { name: "Manage storage" }).click();
    expect(useUIStore.getState()).toMatchObject({ settingsOpen: true, settingsSection: "storage" });
  });

  describe("edge cases", () => {
    it("with Smart cleanup off it keeps everything and still warns", async () => {
      await seedStems();
      useSettingsStore.setState({ smartCleanup: false });
      markPersistenceSettled();
      const screen = await render(<MaintenanceHost />);
      notifyStorageSignal("storage-full");
      await expect
        .element(screen.getByText("Remove audio you don't need so Composer can keep saving."))
        .toBeInTheDocument();
      expect(await listStemJobs()).toHaveLength(1);
    });

    it("stops listening once unmounted", async () => {
      await seedStems();
      markPersistenceSettled();
      const screen = await render(<MaintenanceHost />);
      screen.unmount();
      notifyStorageSignal("storage-full");
      await sleep(100);
      expect(await listStemJobs()).toHaveLength(1);
    });
  });
});

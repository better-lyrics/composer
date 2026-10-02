import { useMissingAudioNotice } from "@/hooks/useMissingAudioNotice";
import { restoreOpenProject } from "@/lib/open-project";
import { setProjectLastTab } from "@/lib/project-repository";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { sleep } from "@/test/async";
import { createAudioFile } from "@/test/audio-fixtures";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const DISMISSED_WELL_BEFORE_AUTO_CLOSE_MS = 1500;

const NoticeHost: React.FC = () => {
  useMissingAudioNotice();
  return <Toaster />;
};

async function openMissingFileOn(tab: "sync" | "import"): Promise<void> {
  await seedStoredProject("p", {
    open: true,
    project: { ...songTitled("City"), audioSource: { kind: "file", name: "city.wav" } },
  });
  await setProjectLastTab("p", tab);
  await restoreOpenProject();
}

// -- Tests --------------------------------------------------------------------

describe("useMissingAudioNotice", () => {
  it("says the audio is missing when the project opens on another tab, and opens Import", async () => {
    await openMissingFileOn("sync");
    const screen = await render(<NoticeHost />);
    await expect.element(screen.getByText("Audio isn't on this device")).toBeInTheDocument();
    await expect.element(screen.getByText("Drop “city.wav” on the Import tab to link it again.")).toBeInTheDocument();
    await screen.getByRole("button", { name: "Open Import" }).click();
    expect(useProjectStore.getState().activeTab).toBe("import");
  });

  it("takes the notice down once the audio arrives", async () => {
    await openMissingFileOn("sync");
    const screen = await render(<NoticeHost />);
    await expect.element(screen.getByText("Audio isn't on this device")).toBeInTheDocument();
    useAudioStore.getState().setSource({ type: "file", file: createAudioFile("city.wav") });
    await expect
      .element(screen.getByText("Audio isn't on this device"), { timeout: DISMISSED_WELL_BEFORE_AUTO_CLOSE_MS })
      .not.toBeInTheDocument();
  });

  it("takes the notice down once the Import tab opens", async () => {
    await openMissingFileOn("sync");
    const screen = await render(<NoticeHost />);
    await expect.element(screen.getByText("Audio isn't on this device")).toBeInTheDocument();
    useProjectStore.getState().setActiveTab("import");
    await expect
      .element(screen.getByText("Audio isn't on this device"), { timeout: DISMISSED_WELL_BEFORE_AUTO_CLOSE_MS })
      .not.toBeInTheDocument();
  });

  describe("edge cases", () => {
    it("stays quiet on the Import tab, which already shows the relink state", async () => {
      await openMissingFileOn("import");
      const screen = await render(<NoticeHost />);
      await sleep(100);
      expect(screen.getByText("Audio isn't on this device").elements()).toHaveLength(0);
    });

    it("says it once per project", async () => {
      await openMissingFileOn("sync");
      const screen = await render(<NoticeHost />);
      await expect.element(screen.getByText("Audio isn't on this device")).toBeInTheDocument();
      useProjectStore.getState().setActiveTab("edit");
      useProjectStore.getState().setActiveTab("sync");
      await sleep(100);
      expect(screen.getByText("Audio isn't on this device").elements()).toHaveLength(1);
    });
  });
});

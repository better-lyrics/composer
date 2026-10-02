import { listStemJobs, putStem } from "@/audio/separation/stem-store";
import { loadProjectAudio } from "@/lib/project-audio";
import { clearVocalStems, clearYouTubeAudio } from "@/lib/storage-actions";
import { createAudioFile } from "@/test/audio-fixtures";
import { indexEntry } from "@/test/index-entries";
import { seedStoredProject } from "@/test/projects";
import { render } from "@/test/render";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { SettingsSearchQueryContext } from "@/ui/settings/settings-search-query";
import { ProjectAudioList } from "@/ui/settings/storage/project-audio-list";
import { Toaster, toast } from "sonner";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const NOW = 1_759_000_000_000;
const ENTRIES = [
  indexEntry("small", { title: "Small file", audioKind: "file", storedAudioBytes: 1_000, openedAt: NOW }),
  indexEntry("big", { title: "Big video", audioKind: "youtube", storedAudioBytes: 9_000, openedAt: NOW }),
  indexEntry("gone", { title: "Gone", audioKind: "file", storedAudioBytes: 0, openedAt: NOW }),
];

function listElement(overrides: Partial<Parameters<typeof ProjectAudioList>[0]> = {}) {
  return (
    <>
      <ProjectAudioList
        entries={ENTRIES}
        openProjectId={undefined}
        now={NOW}
        canClearYouTube
        canClearStems={false}
        {...overrides}
      />
      <ConfirmModalHost />
      <Toaster />
    </>
  );
}

function renderList(overrides: Partial<Parameters<typeof ProjectAudioList>[0]> = {}) {
  return render(listElement(overrides));
}

function rowTitles(screen: Awaited<ReturnType<typeof renderList>>): string[] {
  return screen
    .getByRole("listitem")
    .elements()
    .map((row) => row.querySelector("[data-audio-title]")?.textContent ?? "");
}

// -- Tests --------------------------------------------------------------------

describe("ProjectAudioList", () => {
  it("lists every project with stored audio, largest first", async () => {
    const screen = await renderList();
    await expect.element(screen.getByText("Audio by project")).toBeInTheDocument();
    await expect
      .element(screen.getByText("Removing audio keeps the lyrics and timings. You can add the file again later."))
      .toBeInTheDocument();
    expect(rowTitles(screen)).toEqual(["Big video", "Small file"]);
  });

  it("filters by local files and YouTube", async () => {
    const screen = await renderList();
    await screen.getByRole("button", { name: "Local", exact: true }).click();
    expect(rowTitles(screen)).toEqual(["Small file"]);
    await screen.getByRole("button", { name: "YouTube", exact: true }).click();
    expect(rowTitles(screen)).toEqual(["Big video"]);
  });

  it("removes cached YouTube audio at once", async () => {
    await seedStoredProject("yt", {
      project: { audioSource: { kind: "youtube", videoId: "v" } },
      audio: createAudioFile("yt.opus"),
    });
    const entries = [indexEntry("yt", { title: "Video", audioKind: "youtube", storedAudioBytes: 10, openedAt: NOW })];
    const screen = await renderList({ entries });
    await screen.getByRole("button", { name: "Remove audio from Video" }).click();
    await expect.poll(() => loadProjectAudio("yt")).toBeUndefined();
  });

  it("asks before removing a local file, and keeps it on Cancel", async () => {
    await seedStoredProject("f", {
      project: { audioSource: { kind: "file", name: "f.wav" } },
      audio: createAudioFile("f.wav"),
    });
    const entries = [indexEntry("f", { title: "Song", audioKind: "file", storedAudioBytes: 10, openedAt: NOW })];
    const screen = await renderList({ entries });
    await screen.getByRole("button", { name: "Remove audio from Song" }).click();
    await expect.element(screen.getByText("Remove audio from “Song”?")).toBeInTheDocument();
    await expect
      .element(screen.getByText("The lyrics and timings stay. You'll need the original file to add it back."))
      .toBeInTheDocument();
    await screen.getByRole("button", { name: "Cancel" }).click();
    expect(await loadProjectAudio("f")).toBeDefined();
    await screen.getByRole("button", { name: "Remove audio from Song" }).click();
    await screen.getByRole("button", { name: "Remove audio", exact: true }).click();
    await expect.poll(() => loadProjectAudio("f")).toBeUndefined();
  });

  it("clears YouTube audio and the vocal stems", async () => {
    await seedStoredProject("yt", {
      project: { audioSource: { kind: "youtube", videoId: "v" } },
      audio: createAudioFile("yt.opus"),
    });
    await putStem("h1", "vocals", "fp32", new Blob([new Uint8Array(8)]));
    const screen = await renderList({ canClearStems: true });
    await screen.getByRole("button", { name: "Clear YouTube audio" }).click();
    await expect.element(screen.getByText("Cleared YouTube audio from 1 project")).toBeInTheDocument();
    await screen.getByRole("button", { name: "Clear vocal stems" }).click();
    await expect.element(screen.getByText("Cleared vocal stems")).toBeInTheDocument();
    expect(await listStemJobs()).toEqual([]);
  });

  describe("regressions", () => {
    it("regression: highlights a settings search in the row label and description", async () => {
      const screen = await render(
        <SettingsSearchQueryContext value="audio">{listElement()}</SettingsSearchQueryContext>,
      );
      await expect.element(screen.getByText("Audio by project")).toBeInTheDocument();
      const marks = [...screen.container.querySelectorAll("mark")].map((mark) => mark.textContent);
      expect(marks).toEqual(["Audio", "audio"]);
    });

    it("resets the filter to All once YouTube audio disappears, so it does not jump back when it reappears", async () => {
      const screen = await renderList();
      await screen.getByRole("button", { name: "YouTube", exact: true }).click();
      expect(rowTitles(screen)).toEqual(["Big video"]);
      await screen.rerender(listElement({ entries: [ENTRIES[0]].flatMap((entry) => (entry ? [entry] : [])) }));
      expect(screen.getByRole("group", { name: "Filter audio" }).elements()).toHaveLength(0);
      await screen.rerender(listElement());
      expect(rowTitles(screen)).toEqual(["Big video", "Small file"]);
    });
  });

  describe("edge cases", () => {
    it("hides the filter and Clear YouTube audio when no YouTube audio is stored", async () => {
      const screen = await renderList({
        entries: [ENTRIES[0], ENTRIES[2]].flatMap((entry) => (entry ? [entry] : [])),
        canClearYouTube: false,
      });
      expect(screen.getByRole("group", { name: "Filter audio" }).elements()).toHaveLength(0);
      expect(screen.getByRole("button", { name: "Clear YouTube audio" }).elements()).toHaveLength(0);
    });

    it("hides Clear vocal stems when there are none", async () => {
      const screen = await renderList();
      expect(screen.getByRole("button", { name: "Clear vocal stems" }).elements()).toHaveLength(0);
    });

    it("shows no toast when a clear finds nothing left to remove", async () => {
      const screen = await renderList({ canClearStems: true });
      const before = toast.getHistory().length;
      await screen.getByRole("button", { name: "Clear YouTube audio" }).click();
      await screen.getByRole("button", { name: "Clear vocal stems" }).click();
      await Promise.all([clearYouTubeAudio(), clearVocalStems()]);
      expect(toast.getHistory()).toHaveLength(before);
    });

    it("says when no audio is stored", async () => {
      const screen = await renderList({ entries: [] });
      await expect.element(screen.getByText("No audio is stored on this device.")).toBeInTheDocument();
    });

    it("disables removal for the open project", async () => {
      const screen = await renderList({ openProjectId: "big" });
      await expect
        .element(screen.getByRole("button", { name: "Close Big video to remove its audio" }))
        .toHaveAttribute("aria-disabled", "true");
    });
  });
});

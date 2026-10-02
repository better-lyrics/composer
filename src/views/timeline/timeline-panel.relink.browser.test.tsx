import { restoreOpenProject } from "@/lib/open-project";
import type { SavedProject } from "@/lib/saved-project";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { seedStoredProject } from "@/test/projects";
import { render } from "@/test/render";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { TimelinePanel } from "@/views/timeline/timeline-panel";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

const SONG_DETAILS = { title: "City", artists: ["M83"], album: "Hurry Up", duration: 243 };

async function openWithMissingAudio(audioSource: SavedProject["audioSource"]) {
  await seedStoredProject("p", { open: true, project: { metadata: SONG_DETAILS, audioSource } });
  await restoreOpenProject();
  return render(
    <>
      <TimelinePanel />
      <ConfirmModalHost />
    </>,
  );
}

function sourceFileName(): string | null {
  const source = useAudioStore.getState().source;
  return source?.type === "file" ? source.file.name : null;
}

// -- Tests --------------------------------------------------------------------

describe("TimelinePanel · missing audio", () => {
  describe("regressions", () => {
    it("regression: a different file dropped on the Timeline asks before linking and keeps the song details", async () => {
      const screen = await openWithMissingAudio({ kind: "file", name: "city.wav" });
      await userEvent.upload(screen.getByLabelText("Upload audio file"), createAudioFile("other.wav"));
      await expect.element(screen.getByText("Link a different file?")).toBeInTheDocument();
      expect(useProjectStore.getState().metadata).toMatchObject(SONG_DETAILS);
      await screen.getByRole("button", { name: "Link file" }).click();
      await expect.poll(sourceFileName).toBe("other.wav");
      expect(useProjectStore.getState().metadata).toMatchObject(SONG_DETAILS);
    });

    it("regression: a file dropped on the Timeline of a YouTube project that failed keeps the song details", async () => {
      const screen = await openWithMissingAudio({ kind: "youtube", videoId: "dQw4w9WgXcQ" });
      useAudioStore.getState().failYouTubeLoad("Nope");
      await userEvent.upload(screen.getByLabelText("Upload audio file"), createAudioFile("local.wav"));
      await expect.poll(sourceFileName).toBe("local.wav");
      expect(useProjectStore.getState().metadata).toMatchObject(SONG_DETAILS);
    });
  });
});

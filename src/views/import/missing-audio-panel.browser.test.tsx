import { restoreOpenProject } from "@/lib/open-project";
import { useAudioStore } from "@/stores/audio";
import { useUIStore } from "@/stores/ui";
import { createAudioFile, createUnplayableAudioFile } from "@/test/audio-fixtures";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { MissingAudioPanel } from "@/views/import/missing-audio-panel";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

async function openMissingFile() {
  await seedStoredProject("p", {
    open: true,
    project: { ...songTitled("City"), audioSource: { kind: "file", name: "city.wav" } },
  });
  await restoreOpenProject();
  return render(
    <>
      <MissingAudioPanel expected={{ kind: "file", name: "city.wav" }} />
      <ConfirmModalHost />
      <Toaster />
    </>,
  );
}

async function openFailedVideo(failure: "bridge-unreachable" | "fetch-failed") {
  await seedStoredProject("p", {
    open: true,
    project: { ...songTitled("Song"), audioSource: { kind: "youtube", videoId: "dQw4w9WgXcQ" } },
  });
  await restoreOpenProject();
  useAudioStore.getState().failYouTubeLoad("Nope", failure);
  return render(<MissingAudioPanel expected={{ kind: "youtube", videoId: "dQw4w9WgXcQ" }} />);
}

function sourceFileName(): string | null {
  const source = useAudioStore.getState().source;
  return source?.type === "file" ? source.file.name : null;
}

// -- Tests --------------------------------------------------------------------

describe("MissingAudioPanel · local file", () => {
  it("says the file is not on this device and how to link it", async () => {
    const screen = await openMissingFile();
    await expect.element(screen.getByText("Not on this device. Your lyrics and timings are safe.")).toBeInTheDocument();
    await expect.element(screen.getByText("to link it again", { exact: false })).toBeInTheDocument();
    await expect
      .element(screen.getByText("If the file name is different, you confirm before it links."))
      .toBeInTheDocument();
    await expect.element(screen.getByPlaceholder("Or load it from YouTube")).toBeInTheDocument();
    expect(screen.getByText("city.wav").elements().length).toBeGreaterThanOrEqual(2);
  });

  it("links the same file without asking", async () => {
    const screen = await openMissingFile();
    await userEvent.upload(screen.getByLabelText("Upload audio file"), createAudioFile("city.wav"));
    await expect.poll(sourceFileName).toBe("city.wav");
  });

  it("asks before linking a file with another name", async () => {
    const screen = await openMissingFile();
    await userEvent.upload(screen.getByLabelText("Upload audio file"), createAudioFile("other.wav"));
    await expect.element(screen.getByText("Link a different file?")).toBeInTheDocument();
    await expect
      .element(
        screen.getByText(
          "“other.wav” doesn't match “city.wav”. The timings may not line up if it's a different recording.",
        ),
      )
      .toBeInTheDocument();
    await screen.getByRole("button", { name: "Link file" }).click();
    await expect.poll(sourceFileName).toBe("other.wav");
  });

  it("attaches a YouTube video to this project from the keyboard", async () => {
    const screen = await openMissingFile();
    await screen.getByPlaceholder("Or load it from YouTube").fill("dQw4w9WgXcQ");
    await userEvent.keyboard("{Enter}");
    await expect
      .poll(() => useAudioStore.getState().expectedAudio)
      .toEqual({ kind: "youtube", videoId: "dQw4w9WgXcQ" });
  });

  describe("error paths", () => {
    it("keeps the file missing and shows a toast when the dropped file isn't playable", async () => {
      const screen = await openMissingFile();
      await userEvent.upload(screen.getByLabelText("Upload audio file"), createUnplayableAudioFile());
      await expect.element(screen.getByText("Couldn't link that file")).toBeInTheDocument();
      expect(sourceFileName()).toBeNull();
    });
  });
});

describe("MissingAudioPanel · YouTube", () => {
  it("asks to start Composer Bridge when it could not be reached", async () => {
    const screen = await openFailedVideo("bridge-unreachable");
    await expect.element(screen.getByText("Song")).toBeInTheDocument();
    await expect.element(screen.getByText("Start Composer Bridge, then try again.")).toBeInTheDocument();
    await screen.getByRole("button", { name: "Bridge settings" }).click();
    expect(useUIStore.getState()).toMatchObject({ settingsOpen: true, settingsTarget: { setting: "youtubeBridge" } });
  });

  it("tries again from the keyboard", async () => {
    const screen = await openFailedVideo("bridge-unreachable");
    screen.getByRole("button", { name: "Try again" }).element().focus();
    await userEvent.keyboard("{Enter}");
    expect(useAudioStore.getState().source).toEqual({ type: "youtube", videoId: "dQw4w9WgXcQ" });
  });

  it("offers a local file instead", async () => {
    const screen = await openFailedVideo("fetch-failed");
    await expect.element(screen.getByText("Drop an audio file to use instead")).toBeInTheDocument();
    await expect.element(screen.getByText("Your lyrics and timings stay as they are.")).toBeInTheDocument();
    await userEvent.upload(screen.getByLabelText("Upload audio file"), createAudioFile("local.wav"));
    await expect.poll(sourceFileName).toBe("local.wav");
  });

  describe("edge cases", () => {
    it("reads a plain failure without mentioning the bridge", async () => {
      const screen = await openFailedVideo("fetch-failed");
      await expect.element(screen.getByText("Couldn't load the audio from YouTube.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Bridge settings" }).elements()).toHaveLength(0);
      await expect.element(screen.getByPlaceholder("Or load a different YouTube URL")).toBeInTheDocument();
    });

    it("names the project by its video id when it has no title", async () => {
      await seedStoredProject("p", {
        open: true,
        project: { ...songTitled(""), audioSource: { kind: "youtube", videoId: "dQw4w9WgXcQ" } },
      });
      await restoreOpenProject();
      useAudioStore.getState().failYouTubeLoad("Nope");
      const screen = await render(<MissingAudioPanel expected={{ kind: "youtube", videoId: "dQw4w9WgXcQ" }} />);
      await expect.element(screen.getByText("dQw4w9WgXcQ", { exact: true })).toBeInTheDocument();
    });
  });
});

import { removeProjectData, saveProjectRecord } from "@/lib/project-repository";
import { RecoverProjectList } from "@/pages/recover-project-list";
import { sleep } from "@/test/async";
import { captureDownloads } from "@/test/downloads";
import { songTitled, storedProject } from "@/test/projects";
import { render } from "@/test/render";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

async function seedTwo(): Promise<void> {
  await saveProjectRecord("a", storedProject({ ...songTitled("Alpha"), savedAt: 100 }));
  await saveProjectRecord("b", storedProject({ ...songTitled("Bravo"), savedAt: 300 }));
}

// -- Tests --------------------------------------------------------------------

describe("RecoverProjectList", () => {
  it("lists every project newest first with its line count", async () => {
    await seedTwo();
    const screen = await render(<RecoverProjectList />);
    await expect.element(screen.getByRole("heading", { name: "Every project on this device" })).toBeInTheDocument();
    await expect.element(screen.getByText("2 projects")).toBeInTheDocument();
    const rows = screen
      .getByRole("listitem")
      .elements()
      .map((row) => row.textContent ?? "");
    expect(rows[0]).toContain("Bravo");
    expect(rows[1]).toContain("Alpha");
    expect(rows[0]).toContain("2 lines, last edited");
  });

  it("downloads one project", async () => {
    await seedTwo();
    const screen = await render(<RecoverProjectList />);
    const downloads = captureDownloads();
    await screen.getByRole("button", { name: "Download Alpha" }).click();
    await expect.poll(() => downloads.names().length).toBe(1);
    downloads.stop();
    expect(downloads.names()[0]).toMatch(/^Alpha-/);
  });

  it("downloads everything as one file from the keyboard", async () => {
    await seedTwo();
    const screen = await render(<RecoverProjectList />);
    const downloads = captureDownloads();
    await expect.element(screen.getByRole("button", { name: "Download all" })).toBeInTheDocument();
    screen.getByRole("button", { name: "Download all" }).element().focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(screen.getByText("Downloaded 2 projects as one file.")).toBeInTheDocument();
    downloads.stop();
    expect(downloads.names()).toHaveLength(1);
  });

  describe("edge cases", () => {
    it("shows nothing with a single project, which the main download already covers", async () => {
      await saveProjectRecord("a", storedProject(songTitled("Alpha")));
      const screen = await render(<RecoverProjectList />);
      await sleep(50);
      expect(screen.container.textContent).toBe("");
    });

    it("tells the user when the project to download is already gone", async () => {
      await seedTwo();
      const screen = await render(<RecoverProjectList />);
      await removeProjectData("a");
      await screen.getByRole("button", { name: "Download Alpha" }).click();
      await expect.element(screen.getByText("Couldn't download that project. Try again.")).toBeInTheDocument();
    });

    it("tells the user when every project is gone before download-all runs", async () => {
      await seedTwo();
      const screen = await render(<RecoverProjectList />);
      await removeProjectData("a");
      await removeProjectData("b");
      const downloads = captureDownloads();
      await screen.getByRole("button", { name: "Download all" }).click();
      await expect.element(screen.getByText("Nothing to download.")).toBeInTheDocument();
      downloads.stop();
      expect(downloads.names()).toEqual([]);
    });
  });
});

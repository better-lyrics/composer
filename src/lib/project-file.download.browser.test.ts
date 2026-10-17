import { downloadProjectFile, projectFileFrom } from "@/lib/project-file";
import { captureDownloads } from "@/test/downloads";
import { storedProject } from "@/test/projects";
import { describe, expect, it } from "vitest";

describe("downloadProjectFile", () => {
  it("clicks a temporary download link named after the project and removes it", async () => {
    const downloads = captureDownloads();
    downloadProjectFile(projectFileFrom("p1", storedProject()));
    await expect.poll(() => downloads.anchors().length).toBe(1);
    downloads.stop();
    expect(downloads.names()[0]).toMatch(/^Midnight City-\d{4}-\d{2}-\d{2}\.ttml-project\.json$/);
    expect(downloads.anchors()[0]?.isConnected).toBe(false);
  });
});

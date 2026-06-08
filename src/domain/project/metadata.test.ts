import { describe, it, expect } from "vitest";
import type { ProjectMetadata } from "@/domain/project/metadata";

describe("ProjectMetadata", () => {
  it("accepts an optional thumbnailForVideoId paired with thumbnailDataUrl", () => {
    const m: ProjectMetadata = {
      title: "T",
      artist: "A",
      album: "AL",
      duration: 0,
      thumbnailDataUrl: "data:image/png;base64,xyz",
      thumbnailForVideoId: "dQw4w9WgXcQ",
    };
    expect(m.thumbnailForVideoId).toBe("dQw4w9WgXcQ");
  });

  it("omits thumbnailForVideoId by default", () => {
    const m: ProjectMetadata = { title: "", artist: "", album: "", duration: 0 };
    expect(m.thumbnailForVideoId).toBeUndefined();
  });
});

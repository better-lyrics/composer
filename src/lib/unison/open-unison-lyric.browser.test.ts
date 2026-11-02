import { hasLyricLines } from "@/domain/project/lyrics-presence";
import { restoreOpenProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { loadProjectRecord } from "@/lib/project-storage";
import type { UnisonLyric } from "@/lib/unison/api-types";
import { openUnisonLyric } from "@/lib/unison/open-unison-lyric";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { seedStoredProject, songTitled } from "@/test/projects";
import { EDITOR_PATH } from "@/utils/app-routes";
import { isYouTubeSourceFor } from "@/utils/youtube-source";
import { describe, expect, it } from "vitest";

// -- Constants ----------------------------------------------------------------

const VIDEO_ID = "dQw4w9WgXcQ";

const TTML = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" itunes:timing="Line">
  <body dur="00:20.000">
    <div begin="00:01.000" end="00:10.000">
      <p begin="00:01.000" end="00:04.000" ttm:agent="v1">Never gonna give you up</p>
      <p begin="00:04.000" end="00:08.000" ttm:agent="v1">Never gonna let you down</p>
    </div>
  </body>
</tt>`;

// -- Helpers ------------------------------------------------------------------

function unisonLyric(overrides: Partial<UnisonLyric> = {}): UnisonLyric {
  return {
    id: 4821,
    videoId: VIDEO_ID,
    song: "Never Gonna Give You Up",
    artist: "Rick Astley",
    album: "Whenever You Need Somebody",
    isrc: "GBARL9300135",
    language: "en",
    lyrics: TTML,
    format: "ttml",
    syncType: "linesync",
    score: 3,
    effectiveScore: 3,
    voteCount: 3,
    confidence: "high",
    hidden: false,
    userVote: null,
    revision: { revNo: 1, count: 1, pending: null, lastRejected: null, updatedAt: 1_758_900_000_000 },
    ...overrides,
  };
}

async function openLinkedAlpha(): Promise<void> {
  await seedStoredProject("a", { open: true, project: { ...songTitled("Alpha"), unisonLyricId: "77" } });
  await restoreOpenProject();
}

function videoFile(): File {
  return new File([new Uint8Array([1, 2, 3])], `${VIDEO_ID}.opus`, { type: "audio/ogg" });
}

// -- Tests --------------------------------------------------------------------

describe("openUnisonLyric", () => {
  it("opens the user's own lyric as a new linked project with its lines, details and video", async () => {
    await openLinkedAlpha();
    const paths: string[] = [];
    const opening = openUnisonLyric(unisonLyric(), { link: true, navigate: (path) => paths.push(path) });
    await expect.poll(() => isYouTubeSourceFor(useAudioStore.getState().source, VIDEO_ID)).toBe(true);
    useAudioStore.getState().setYouTubeFile(videoFile());
    await opening;

    const project = useProjectStore.getState();
    expect(openProjectIdSnapshot()).not.toBe("a");
    expect(project.lines.map((line) => line.text)).toEqual(["Never gonna give you up", "Never gonna let you down"]);
    expect(project.metadata).toMatchObject({
      title: "Never Gonna Give You Up",
      artists: ["Rick Astley"],
      album: "Whenever You Need Somebody",
      isrc: "GBARL9300135",
      language: "en",
    });
    expect(project.unisonLyricId).toBe("4821");
    expect(paths).toEqual([EDITOR_PATH]);

    const previous = await loadProjectRecord("a");
    expect(previous?.metadata.title).toBe("Alpha");
    expect(previous?.unisonLyricId).toBe("77");
  });

  it("opens someone else's lyric without a link", async () => {
    await openLinkedAlpha();
    const opening = openUnisonLyric(unisonLyric(), { link: false, navigate: () => {} });
    await expect.poll(() => isYouTubeSourceFor(useAudioStore.getState().source, VIDEO_ID)).toBe(true);
    useAudioStore.getState().setYouTubeFile(videoFile());
    await opening;

    expect(openProjectIdSnapshot()).not.toBe("a");
    expect(hasLyricLines(useProjectStore.getState().lines)).toBe(true);
    expect(useProjectStore.getState().unisonLyricId).toBeNull();
  });

  describe("error paths", () => {
    it("keeps the lyrics with missing audio when the video does not load", async () => {
      await openLinkedAlpha();
      const opening = openUnisonLyric(unisonLyric(), { link: true, navigate: () => {} });
      await expect.poll(() => isYouTubeSourceFor(useAudioStore.getState().source, VIDEO_ID)).toBe(true);
      const newId = openProjectIdSnapshot();
      useAudioStore.getState().failYouTubeLoad("Could not load that video. Try again.");
      await expect(opening).resolves.toBeUndefined();

      expect(openProjectIdSnapshot()).toBe(newId);
      expect(useAudioStore.getState().source).toBeNull();
      expect(useProjectStore.getState().lines).toHaveLength(2);
      expect(useProjectStore.getState().unisonLyricId).toBe("4821");
    });

    it("opens nothing when the lyrics cannot be read", async () => {
      await openLinkedAlpha();
      const paths: string[] = [];
      await openUnisonLyric(unisonLyric({ lyrics: "" }), { link: true, navigate: (path) => paths.push(path) });

      expect(openProjectIdSnapshot()).toBe("a");
      expect(paths).toEqual([]);
      expect(useAudioStore.getState().source).toBeNull();
    });
  });
});

import { lineText } from "insync/line-text";
import { useImportFromQuery } from "@/hooks/useImportFromQuery";
import { useImportFromUnisonLyric } from "@/hooks/useImportFromUnisonLyric";
import { useImportFromYouTube } from "@/hooks/useImportFromYouTube";
import { usePersistence } from "@/hooks/usePersistence";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import {
  type LinkProjectOutcome,
  getLinkProjectSettled,
  getPersistenceSettled,
  getQueryImportSettled,
} from "@/lib/persistence-settled";
import { loadProjectRecord } from "@/lib/project-storage";
import type { UnisonLyric } from "@/lib/unison/api-types";
import { UNISON_BASE_URL } from "@/lib/unison/client";
import { type StoredUnisonSession, UNISON_SESSION_STORAGE_KEY } from "@/lib/unison/session";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { allowConsole } from "@/test/console-guard";
import { seedStoredProject, songTitled } from "@/test/projects";
import { render } from "@/test/render";
import { getSplitCharacter } from "@/utils/split-character";
import { hasLoadedYouTubeSourceFor, isYouTubeSourceFor } from "@/utils/youtube-source";
import { Toaster } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// -- Constants ----------------------------------------------------------------

const LYRIC_ID = 4821;
const VIDEO_ID = "hArb0urL1te";
const FAILED_TOAST = "Could not open that lyric from Unison. Check the link and try again.";
const CREATED_TOAST = "Opened “Harbour Lights” in a new project";

const SESSION: StoredUnisonSession = {
  token: "test-token",
  expiresAt: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
  keyId: "key-test",
  displayName: "Test Submitter",
  avatarUrl: null,
};

const TTML = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" itunes:timing="Line">
  <body dur="00:20.000">
    <div begin="00:01.000" end="00:10.000">
      <p begin="00:01.000" end="00:04.000" ttm:agent="v1">Paper lanterns over the bay</p>
      <p begin="00:04.000" end="00:08.000" ttm:agent="v1">Quiet bells along the pier</p>
    </div>
  </body>
</tt>`;

// -- Helpers ------------------------------------------------------------------

const LinkHost: React.FC = () => {
  usePersistence();
  useImportFromQuery();
  useImportFromYouTube();
  useImportFromUnisonLyric();
  return <Toaster />;
};

function ownLyric(overrides: Partial<UnisonLyric> = {}): UnisonLyric {
  return {
    id: LYRIC_ID,
    videoId: VIDEO_ID,
    song: "Harbour Lights",
    artist: "Test Artist",
    lyrics: TTML,
    format: "ttml",
    syncType: "linesync",
    score: 3,
    effectiveScore: 3,
    voteCount: 3,
    confidence: "high",
    hidden: false,
    submitter: {
      keyId: SESSION.keyId,
      displayName: SESSION.displayName,
      tier: null,
      level: 1,
      badgeCount: 0,
      topBadge: null,
      featured: [],
      avatarUrl: null,
      reputation: 0,
    },
    userVote: null,
    revision: { revNo: 1, count: 1, pending: null, lastRejected: null, updatedAt: 1_758_900_000_000 },
    ...overrides,
  };
}

function stubUnisonLyric(lyric: UnisonLyric | null): void {
  vi.stubGlobal("fetch", async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url !== `${UNISON_BASE_URL}/lyrics/${LYRIC_ID}`) throw new Error(`Unexpected request: ${url}`);
    if (!lyric) return Response.json({ success: false, error: "Server error" }, { status: 500 });
    return Response.json({ success: true, data: lyric });
  });
}

async function seedOpenAlpha(): Promise<void> {
  await seedStoredProject("a", { open: true, project: songTitled("Alpha") });
}

function trackLinkOutcome(): () => LinkProjectOutcome | null {
  let outcome: LinkProjectOutcome | null = null;
  void getLinkProjectSettled().then((value) => {
    outcome = value;
  });
  return () => outcome;
}

async function bootWithLink(search: string) {
  window.history.replaceState(null, "", `/${search}`);
  const outcome = trackLinkOutcome();
  const screen = await render(<LinkHost />, { withRouter: true });
  await getPersistenceSettled();
  return { screen, outcome };
}

async function finishVideoLoad(): Promise<void> {
  await expect.poll(() => isYouTubeSourceFor(useAudioStore.getState().source, VIDEO_ID)).toBe(true);
  useAudioStore.getState().setYouTubeFile(createAudioFile(`${VIDEO_ID}.opus`));
}

// -- Tests --------------------------------------------------------------------

describe("useImportFromUnisonLyric", () => {
  beforeEach(() => localStorage.setItem(UNISON_SESSION_STORAGE_KEY, JSON.stringify(SESSION)));
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.removeItem(UNISON_SESSION_STORAGE_KEY);
    window.history.replaceState(null, "", "/");
  });

  it("opens the linked lyric as a new linked project and leaves the open one unchanged", async () => {
    await seedOpenAlpha();
    stubUnisonLyric(ownLyric());
    const { screen, outcome } = await bootWithLink(`?unisonLyric=${LYRIC_ID}`);
    await finishVideoLoad();

    await expect.poll(outcome).toBe("created");
    await expect.element(screen.getByText(CREATED_TOAST)).toBeInTheDocument();
    expect(screen.getByText(CREATED_TOAST).elements()).toHaveLength(1);
    expect(useProjectStore.getState().activeTab).toBe("edit");
    expect(openProjectIdSnapshot()).not.toBe("a");
    expect(useProjectStore.getState().lines.map((line) => lineText(line, getSplitCharacter()))).toEqual([
      "Paper lanterns over the bay",
      "Quiet bells along the pier",
    ]);
    expect(useProjectStore.getState().unisonLyricId).toBe(String(LYRIC_ID));
    expect(window.location.search).toBe("");
    const alpha = await loadProjectRecord("a");
    expect(alpha?.metadata.title).toBe("Alpha");
    expect(alpha?.unisonLyricId).toBeUndefined();
  });

  it("settles the link as created before the video loads, so the link's song details land in the new project", async () => {
    await seedOpenAlpha();
    stubUnisonLyric(ownLyric());
    const { outcome } = await bootWithLink(`?unisonLyric=${LYRIC_ID}&title=Harbour%20Lights%20(Acoustic)`);
    await expect.poll(() => isYouTubeSourceFor(useAudioStore.getState().source, VIDEO_ID)).toBe(true);
    const newId = openProjectIdSnapshot();

    await expect.poll(outcome).toBe("created");
    await getQueryImportSettled();
    expect(hasLoadedYouTubeSourceFor(useAudioStore.getState().source, VIDEO_ID)).toBe(false);
    expect(openProjectIdSnapshot()).toBe(newId);
    expect(useProjectStore.getState().metadata.title).toBe("Harbour Lights (Acoustic)");
    expect((await loadProjectRecord("a"))?.metadata.title).toBe("Alpha");
    await finishVideoLoad();
  });

  it("opens your own lyric unlinked when a project already carries its link", async () => {
    await seedOpenAlpha();
    await seedStoredProject("b", { project: { ...songTitled("Bravo"), unisonLyricId: String(LYRIC_ID) } });
    stubUnisonLyric(ownLyric());
    const { outcome } = await bootWithLink(`?unisonLyric=${LYRIC_ID}`);
    await finishVideoLoad();

    await expect.poll(outcome).toBe("created");
    expect(openProjectIdSnapshot()).not.toBe("a");
    expect(openProjectIdSnapshot()).not.toBe("b");
    expect(useProjectStore.getState().lines).toHaveLength(2);
    expect(useProjectStore.getState().unisonLyricId).toBeNull();
  });

  it("opens a lyric with no submitter unlinked", async () => {
    await seedOpenAlpha();
    stubUnisonLyric(ownLyric({ submitter: undefined }));
    const { outcome } = await bootWithLink(`?unisonLyric=${LYRIC_ID}`);
    await finishVideoLoad();

    await expect.poll(outcome).toBe("created");
    expect(useProjectStore.getState().lines).toHaveLength(2);
    expect(useProjectStore.getState().unisonLyricId).toBeNull();
  });

  describe("error paths", () => {
    it("leaves the open project alone when the lyric cannot be fetched", async () => {
      allowConsole(/could not fetch the linked Unison lyric/);
      await seedOpenAlpha();
      stubUnisonLyric(null);
      const { screen, outcome } = await bootWithLink(`?unisonLyric=${LYRIC_ID}`);

      await expect.element(screen.getByText(FAILED_TOAST)).toBeInTheDocument();
      await expect.poll(outcome).toBe("failed");
      expect(openProjectIdSnapshot()).toBe("a");
      expect(useProjectStore.getState().metadata.title).toBe("Alpha");
    });

    it("keeps the lyric project in view and offers Switch back when the video does not load", async () => {
      await seedOpenAlpha();
      stubUnisonLyric(ownLyric());
      const { screen, outcome } = await bootWithLink(`?unisonLyric=${LYRIC_ID}`);
      await expect.poll(() => isYouTubeSourceFor(useAudioStore.getState().source, VIDEO_ID)).toBe(true);
      useAudioStore.getState().failYouTubeLoad("Couldn't load YouTube audio.");

      await expect.poll(outcome).toBe("created");
      await expect.element(screen.getByText(CREATED_TOAST)).toBeInTheDocument();
      expect(useProjectStore.getState().activeTab).toBe("edit");
      await screen.getByRole("button", { name: "Switch back" }).click();
      await expect.poll(openProjectIdSnapshot).toBe("a");
      expect(useProjectStore.getState().metadata.title).toBe("Alpha");
    });

    it("leaves the open project alone when the lyric cannot be read", async () => {
      await seedOpenAlpha();
      stubUnisonLyric(ownLyric({ lyrics: "" }));
      const { outcome } = await bootWithLink(`?unisonLyric=${LYRIC_ID}`);

      await expect.poll(outcome).toBe("failed");
      expect(openProjectIdSnapshot()).toBe("a");
      expect(useProjectStore.getState().metadata.title).toBe("Alpha");
      expect(useAudioStore.getState().source).toBeNull();
    });

    it("shows the failure toast once for a link that is not a lyric id and boots normally", async () => {
      await seedOpenAlpha();
      stubUnisonLyric(null);
      const { screen, outcome } = await bootWithLink("?unisonLyric=abc");

      await expect.element(screen.getByText(FAILED_TOAST)).toBeInTheDocument();
      expect(screen.getByText(FAILED_TOAST).elements()).toHaveLength(1);
      await expect.poll(outcome).toBe("none");
      expect(openProjectIdSnapshot()).toBe("a");
      expect(window.location.search).toBe("");
    });
  });
});

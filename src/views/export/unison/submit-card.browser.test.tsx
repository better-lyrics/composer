import type { LyricsSubmission, UnisonLyric } from "@/lib/unison/api-types";
import { UNISON_BASE_URL } from "@/lib/unison/client";
import type { RevisionPreview } from "@/lib/unison/revision-types";
import { type StoredUnisonSession, UNISON_SESSION_STORAGE_KEY } from "@/lib/unison/session";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { generateProjectTtml } from "@/utils/ttml";
import { ExportPanel } from "@/views/export";
import { Toaster } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

// -- Constants ----------------------------------------------------------------

const VIDEO_ID = "hArb0urL1te";
const SONG_SECONDS = 200;
const SUBMITTED_ID = 4217;

const SESSION: StoredUnisonSession = {
  token: "test-token",
  expiresAt: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
  keyId: "key-test",
  displayName: "Test Submitter",
  avatarUrl: null,
};

const SUBMITTER: NonNullable<UnisonLyric["submitter"]> = {
  keyId: SESSION.keyId,
  displayName: SESSION.displayName,
  tier: null,
  level: 1,
  badgeCount: 0,
  topBadge: null,
  featured: [],
  avatarUrl: null,
  reputation: 0,
};

const NO_CHANGES_PREVIEW: RevisionPreview = {
  checks: [],
  drift: { text: 0, timing: 0, timingOffsetMs: 0, textLimit: 1, timingLimit: 1, anchorRevNo: 1 },
  outcome: { goesLive: true, reason: null },
  noChanges: true,
  rateLimit: { lyricRemaining: 10, lyricLimit: 10, userRemaining: 10, userLimit: 10 },
  diff: { rows: [], againstRevNo: 1 },
};

// -- Helpers ------------------------------------------------------------------

function submittedLyric(submission: LyricsSubmission): UnisonLyric {
  return {
    id: SUBMITTED_ID,
    videoId: submission.videoId,
    song: submission.song,
    artist: submission.artist,
    lyrics: submission.lyrics,
    format: submission.format,
    syncType: "word",
    score: 0,
    effectiveScore: 0,
    voteCount: 0,
    confidence: "low",
    hidden: false,
    submitter: SUBMITTER,
    userVote: null,
    revision: { revNo: 1, count: 1, pending: null, lastRejected: null, updatedAt: 0 },
  };
}

function ok(data: unknown): Response {
  return Response.json({ success: true, data });
}

function stubUnison(): LyricsSubmission[] {
  const submissions: LyricsSubmission[] = [];
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? "GET";
    const route = `${method} ${url.startsWith(UNISON_BASE_URL) ? url.slice(UNISON_BASE_URL.length) : url}`;
    const submitted = submissions.at(-1);
    switch (route) {
      case `GET /lyrics/variants/${VIDEO_ID}`:
        return ok(submitted ? [submittedLyric(submitted)] : []);
      case "POST /lyrics/suggested-videos":
      case `POST /lyrics/${SUBMITTED_ID}/suggested-videos`:
        return ok({ suggestions: [] });
      case "POST /lyrics/submit":
        submissions.push(JSON.parse(String(init?.body)));
        return ok({ id: SUBMITTED_ID, created: true });
      case `GET /lyrics/${SUBMITTED_ID}`:
        if (!submitted) break;
        return ok(submittedLyric(submitted));
      case `GET /lyrics/${SUBMITTED_ID}/videos`:
        return ok({ videos: [{ videoId: VIDEO_ID, isPrimary: true }] });
      case `POST /lyrics/${SUBMITTED_ID}/revisions/preview`:
        return ok(NO_CHANGES_PREVIEW);
    }
    throw new Error(`Unexpected request in the Unison submit test: ${route}`);
  });
  return submissions;
}

function loadSyncedProject(): void {
  useSettingsStore.setState({ musicBrainzLookup: "off" });
  useAudioStore.setState({ source: { type: "youtube", videoId: VIDEO_ID }, duration: SONG_SECONDS });
  useProjectStore.setState({
    metadata: { title: "Harbour Lights", artists: ["Test Artist"], album: "", duration: SONG_SECONDS },
    lines: [
      createLine({
        text: "Paper lanterns over the bay",
        words: [
          { text: "Paper ", begin: 1, end: 1.5 },
          { text: "lanterns ", begin: 1.5, end: 2.2 },
          { text: "over ", begin: 2.2, end: 2.6 },
          { text: "the ", begin: 2.6, end: 2.8 },
          { text: "bay", begin: 2.8, end: 3.6 },
        ],
      }),
      createLine({
        text: "Quiet bells along the pier",
        words: [
          { text: "Quiet ", begin: 4, end: 4.5 },
          { text: "bells ", begin: 4.5, end: 5.1 },
          { text: "along ", begin: 5.1, end: 5.6 },
          { text: "the ", begin: 5.6, end: 5.8 },
          { text: "pier", begin: 5.8, end: 6.7 },
        ],
      }),
    ],
  });
}

function exportedTtml(): string {
  const project = useProjectStore.getState();
  return generateProjectTtml(project, SONG_SECONDS, project.exportTiming, VIDEO_ID);
}

// -- Tests --------------------------------------------------------------------

describe("Unison submit card", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.removeItem(UNISON_SESSION_STORAGE_KEY);
  });

  it("submits the exported TTML and links the project to the new lyric", async () => {
    localStorage.setItem(UNISON_SESSION_STORAGE_KEY, JSON.stringify(SESSION));
    const submissions = stubUnison();
    loadSyncedProject();
    const screen = await render(
      <>
        <ExportPanel />
        <Toaster />
      </>,
    );

    const submit = screen.getByRole("button", { name: "Submit to Unison" });
    await expect.element(submit).toBeEnabled();
    await submit.click();

    await expect.poll(() => submissions.length).toBe(1);
    const [submission] = submissions;
    expect(submission?.videoId).toBe(VIDEO_ID);
    expect(submission?.format).toBe("ttml");
    expect(submission?.lyrics).toBe(exportedTtml());
    await expect.poll(() => useProjectStore.getState().unisonLyricId).toBe(String(SUBMITTED_ID));
    await expect.element(screen.getByText("Submitted to Unison. It's live now.")).toBeInTheDocument();
  });
});

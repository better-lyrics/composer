import type { UnisonLyric } from "@/lib/unison/api-types";
import { outgoingTtml } from "@/lib/outgoing-ttml";
import { UNISON_BASE_URL } from "@/lib/unison/client";
import type { RevisionPreview, RevisionStatus, RevisionSummary } from "@/lib/unison/revision-types";
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
const LYRIC_ID = 4217;
const NOW_SEC = Math.floor(Date.now() / 1000);
const DAY_SEC = 86_400;
const WEEK_SEC = 7 * DAY_SEC;
const SUGGESTED_AT_SEC = NOW_SEC - 3 * DAY_SEC - 7200;
const NOTE = "Line 1 came in late";

const SESSION: StoredUnisonSession = {
  token: "test-token",
  expiresAt: NOW_SEC + 24 * 60 * 60,
  keyId: "key-ren",
  displayName: "Ren Okafor",
  avatarUrl: null,
};

const MIRELLE: NonNullable<UnisonLyric["submitter"]> = {
  keyId: "key-mirelle",
  displayName: "Mirelle",
  tier: null,
  level: 4,
  badgeCount: 0,
  topBadge: null,
  featured: [],
  avatarUrl: null,
  reputation: 1,
};

const PREVIEW: RevisionPreview = {
  checks: [
    { field: "lyrics", status: "ok", message: "TTML, richsync, 2 lines." },
    { field: "language", status: "ok", message: "Language: en." },
  ],
  drift: { text: 0, timing: 0.02, timingOffsetMs: 0, textLimit: 0.15, timingLimit: 0.3, anchorRevNo: 3 },
  outcome: { goesLive: false, reason: "suggested" },
  noChanges: false,
  rateLimit: { lyricRemaining: 3, lyricLimit: 3, userRemaining: 10, userLimit: 10 },
  diff: {
    rows: [{ kind: "timing", lineNo: 1, startMs: 1000, deltaMs: 120, text: "Paper lanterns over the bay" }],
    againstRevNo: 3,
  },
  noteMaxLength: 300,
  ownerDecisionSec: WEEK_SEC,
  decider: "owner",
};

// -- Helpers ------------------------------------------------------------------

interface StubState {
  sent: { lyrics: string; note?: string }[];
  withdrawn: boolean;
}

function ok(data: unknown): Response {
  return Response.json({ success: true, data });
}

function summary(id: number, revNo: number, status: RevisionStatus, authorKeyId: string): RevisionSummary {
  return {
    id,
    revNo,
    status,
    pendingReason: null,
    isAnchor: revNo === 1,
    textDrift: 0,
    timingDrift: 0,
    revertsRevNo: null,
    author: null,
    reviewNote: null,
    createdAt: NOW_SEC - 7200,
    reviewedAt: null,
    authorKeyId,
  };
}

function stubUnison(submitter: UnisonLyric["submitter"], suggestedAt = SUGGESTED_AT_SEC): StubState {
  const state: StubState = { sent: [], withdrawn: false };
  const waiting = () => state.sent.length > 0 && !state.withdrawn;
  const lyric = (): UnisonLyric => ({
    id: LYRIC_ID,
    videoId: VIDEO_ID,
    song: "Harbour Lights",
    artist: "Test Artist",
    lyrics: "Paper lanterns over the bay",
    format: "plain",
    syncType: "plain",
    score: 4,
    effectiveScore: 4,
    voteCount: 4,
    confidence: "medium",
    hidden: false,
    userVote: null,
    ...(submitter ? { submitter } : {}),
    revision: {
      revNo: 3,
      count: 3,
      pending: null,
      lastRejected: null,
      updatedAt: 0,
      ...(waiting()
        ? {
            suggestion: {
              id: 9310,
              revNo: 4,
              author: { displayName: SESSION.displayName },
              authorKeyId: SESSION.keyId,
              authorAvatarUrl: null,
              pendingReason: "suggested",
              sealed: false,
              createdAt: suggestedAt,
              councilDecidesAt: suggestedAt + WEEK_SEC,
              note: state.sent.at(-1)?.note ?? null,
              rejectNoteMaxLength: 1000,
              decider: "owner",
            },
          }
        : {}),
    },
  });
  const history = () => [
    ...(state.withdrawn ? [summary(9310, 4, "withdrawn", SESSION.keyId)] : []),
    summary(9300, 3, "live", MIRELLE.keyId),
  ];
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? "GET";
    const route = `${method} ${url.startsWith(UNISON_BASE_URL) ? url.slice(UNISON_BASE_URL.length) : url}`;
    switch (route) {
      case `GET /lyrics/${LYRIC_ID}`:
        return ok(lyric());
      case `GET /lyrics/${LYRIC_ID}/videos`:
        return ok({ videos: [{ videoId: VIDEO_ID, isPrimary: true }] });
      case `GET /lyrics/${LYRIC_ID}/revisions`:
        return ok({ revisions: history() });
      case `POST /lyrics/${LYRIC_ID}/revisions/compare`:
        return ok({ same: false });
      case `POST /lyrics/${LYRIC_ID}/revisions/preview`:
        return ok(PREVIEW);
      case `POST /lyrics/${LYRIC_ID}/revisions`:
        state.sent.push(JSON.parse(String(init?.body)));
        state.withdrawn = false;
        return ok({ revision: summary(9310, 4, "pending", SESSION.keyId), decider: "owner" });
      case `DELETE /lyrics/${LYRIC_ID}/revisions/pending`:
        state.withdrawn = true;
        return ok({ revision: summary(9310, 4, "withdrawn", SESSION.keyId) });
    }
    throw new Error(`Unexpected request in the Unison suggest test: ${route}`);
  });
  return state;
}

function loadLinkedProject(): void {
  useSettingsStore.setState({ musicBrainzLookup: "off" });
  useAudioStore.setState({ source: { type: "youtube", videoId: VIDEO_ID }, duration: SONG_SECONDS });
  useProjectStore.setState({
    unisonLyricId: String(LYRIC_ID),
    metadata: { title: "Harbour Lights", artists: ["Test Artist"], album: "", duration: SONG_SECONDS },
    lines: [
      createLine({
        text: "Paper lanterns over the bay",
        words: [
          { text: "Paper ", begin: 1.12, end: 1.5 },
          { text: "lanterns ", begin: 1.5, end: 2.2 },
          { text: "over ", begin: 2.2, end: 2.6 },
          { text: "the ", begin: 2.6, end: 2.8 },
          { text: "bay", begin: 2.8, end: 3.6 },
        ],
      }),
    ],
  });
}

function copiedTtml(): string {
  const project = useProjectStore.getState();
  return outgoingTtml({
    editedContent: null,
    generatedContent: generateProjectTtml(project, SONG_SECONDS, project.exportTiming, VIDEO_ID),
    duration: SONG_SECONDS,
    exportTiming: project.exportTiming,
    youtubeVideoId: VIDEO_ID,
  });
}

function renderPanel() {
  localStorage.setItem(UNISON_SESSION_STORAGE_KEY, JSON.stringify(SESSION));
  return render(
    <>
      <ExportPanel />
      <Toaster />
    </>,
  );
}

// -- Tests --------------------------------------------------------------------

describe("Unison suggest card", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.removeItem(UNISON_SESSION_STORAGE_KEY);
  });

  it("sends the exported TTML and the note as a suggestion", async () => {
    const state = stubUnison(MIRELLE);
    loadLinkedProject();
    const screen = await renderPanel();

    await expect
      .element(screen.getByRole("heading", { name: "Suggest an edit to Mirelle's lyric" }))
      .toBeInTheDocument();
    await screen.getByLabelText("Note for Mirelle (optional)").fill(NOTE);
    const send = screen.getByRole("button", { name: "Send suggestion" });
    await expect.element(send, { timeout: 5000 }).toBeEnabled();
    await send.click();

    await expect.poll(() => state.sent.length).toBe(1);
    expect(state.sent[0]).toMatchObject({ lyrics: copiedTtml(), note: NOTE });
    await expect.element(screen.getByText("Suggestion sent")).toBeInTheDocument();
  });

  it("regression: a lyric with no submitter gets the suggest card, never Send update", async () => {
    stubUnison(undefined);
    loadLinkedProject();
    const screen = await renderPanel();

    await expect.element(screen.getByRole("heading", { name: "Suggest an edit to this lyric" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send update" }).query()).toBeNull();
  });

  it("shows the waiting suggestion with its note and withdraws it", async () => {
    const state = stubUnison(MIRELLE);
    state.sent.push({ lyrics: copiedTtml(), note: NOTE });
    loadLinkedProject();
    const screen = await renderPanel();

    await expect.element(screen.getByRole("heading", { name: "Your suggestion is waiting" })).toBeInTheDocument();
    await expect.element(screen.getByText(NOTE)).toBeInTheDocument();
    await expect
      .element(screen.getByText("Mirelle has 4 days to decide. After that, the council can too."))
      .toBeInTheDocument();
    await screen.getByRole("button", { name: "Withdraw suggestion" }).click();

    await expect.poll(() => state.withdrawn).toBe(true);
    await expect
      .element(screen.getByRole("heading", { name: "Suggest an edit to Mirelle's lyric" }))
      .toBeInTheDocument();
    await expect.element(screen.getByText("You withdrew your suggestion. Rev 3 stays live.")).toBeInTheDocument();
  });

  it("asks a signed-out user on a linked lyric to connect for a suggestion", async () => {
    stubUnison(MIRELLE);
    loadLinkedProject();
    const screen = await render(<ExportPanel />);

    await expect
      .element(screen.getByRole("heading", { name: "Suggest an edit to Mirelle's lyric" }))
      .toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Connect to suggest" })).toBeInTheDocument();

    useProjectStore.setState({ unisonLyricId: null });
    await expect.element(screen.getByRole("button", { name: "Connect to submit" })).toBeInTheDocument();
  });

  it("regression: a suggestion stamped a moment ahead never shows more than the full owner window", async () => {
    const state = stubUnison(MIRELLE, Date.now() / 1000 + 1);
    state.sent.push({ lyrics: copiedTtml(), note: NOTE });
    loadLinkedProject();
    const screen = await renderPanel();

    await expect
      .element(screen.getByText("Mirelle has 7 days to decide. After that, the council can too."))
      .toBeInTheDocument();
  });
});

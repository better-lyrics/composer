import type {
  LyricsSubmission,
  LyricsSubmissionResult,
  LyricVideoSuggestions,
  SongForSuggestions,
  SuggestedVideo,
  UnisonChallenge,
  UnisonLyric,
  UnisonMineItem,
  UnisonPage,
  UnisonProfile,
  UnisonSearchResult,
  UnisonSessionResponse,
  UnisonSignedSessionBody,
  UnisonVariant,
  VideoLink,
  WantedSong,
} from "@/lib/unison/api-types";
import { unisonFetch, unisonFetchPage } from "@/lib/unison/client";
import type {
  RevisionDetail,
  RevisionDiff,
  RevisionInput,
  RevisionPreview,
  RevisionSummary,
} from "@/lib/unison/revision-types";

// -- Types ---------------------------------------------------------------------

interface CallOptions {
  signal?: AbortSignal;
}

interface PageOptions extends CallOptions {
  cursor?: string;
}

interface SizedPageOptions extends PageOptions {
  limit?: number;
}

// -- Auth ----------------------------------------------------------------------

function fetchChallenge(options: CallOptions = {}): Promise<UnisonChallenge> {
  return unisonFetch("/auth/challenge", options);
}

function createSession(signedBody: UnisonSignedSessionBody, options: CallOptions = {}): Promise<UnisonSessionResponse> {
  return unisonFetch("/auth/session", { ...options, method: "POST", body: signedBody });
}

async function logout(options: CallOptions = {}): Promise<void> {
  await unisonFetch("/auth/logout", { ...options, method: "POST", auth: true });
}

// -- Profile -------------------------------------------------------------------

function fetchProfile(keyId: string, options: CallOptions = {}): Promise<UnisonProfile> {
  return unisonFetch(`/leaderboard/users/${keyId}`, options);
}

// -- Lyrics --------------------------------------------------------------------

function fetchMine({ cursor, limit, signal }: SizedPageOptions = {}): Promise<UnisonPage<UnisonMineItem>> {
  return unisonFetchPage("/lyrics/mine", {
    signal,
    auth: true,
    query: { cursor, limit: limit === undefined ? undefined : String(limit) },
  });
}

function fetchLyric(id: number, options: CallOptions = {}): Promise<UnisonLyric> {
  return unisonFetch(`/lyrics/${id}`, options);
}

function submitLyrics(input: LyricsSubmission, options: CallOptions = {}): Promise<LyricsSubmissionResult> {
  return unisonFetch("/lyrics/submit", { ...options, method: "POST", body: input, auth: true });
}

async function deleteLyrics(id: number, options: CallOptions = {}): Promise<void> {
  await unisonFetch(`/lyrics/${id}`, { ...options, method: "DELETE", auth: true });
}

function searchLyrics(q: string, options: CallOptions = {}): Promise<UnisonSearchResult[]> {
  return unisonFetch("/lyrics/search", { ...options, query: { q } });
}

function fetchVariants(videoId: string, options: CallOptions = {}): Promise<UnisonVariant[]> {
  return unisonFetch(`/lyrics/variants/${encodeURIComponent(videoId)}`, options);
}

// -- Revisions -----------------------------------------------------------------

async function fetchRevisions(id: number, options: CallOptions = {}): Promise<RevisionSummary[]> {
  const { revisions } = await unisonFetch<{ revisions: RevisionSummary[] }>(`/lyrics/${id}/revisions`, options);
  return revisions;
}

function fetchRevision(id: number, revId: number, options: CallOptions = {}): Promise<RevisionDetail> {
  return unisonFetch(`/lyrics/${id}/revisions/${revId}`, options);
}

// Without `againstRevId`, Unison compares with the revision that was live before this one.
function fetchRevisionDiff(
  id: number,
  revId: number,
  againstRevId: number | null,
  options: CallOptions = {},
): Promise<RevisionDiff> {
  const query = { against: againstRevId === null ? undefined : String(againstRevId) };
  return unisonFetch(`/lyrics/${id}/revisions/${revId}/diff`, { ...options, query });
}

function previewRevision(id: number, input: RevisionInput, options: CallOptions = {}): Promise<RevisionPreview> {
  return unisonFetch(`/lyrics/${id}/revisions/preview`, { ...options, method: "POST", body: input, auth: true });
}

async function compareWithLive(id: number, input: RevisionInput, options: CallOptions = {}): Promise<boolean> {
  const { same } = await unisonFetch<{ same: boolean }>(`/lyrics/${id}/revisions/compare`, {
    ...options,
    method: "POST",
    body: input,
    auth: true,
  });
  return same;
}

async function saveRevision(id: number, input: RevisionInput, options: CallOptions = {}): Promise<RevisionSummary> {
  const { revision } = await unisonFetch<{ revision: RevisionSummary }>(`/lyrics/${id}/revisions`, {
    ...options,
    method: "POST",
    body: input,
    auth: true,
  });
  return revision;
}

async function revertRevision(id: number, revId: number, options: CallOptions = {}): Promise<RevisionSummary> {
  const { revision } = await unisonFetch<{ revision: RevisionSummary }>(`/lyrics/${id}/revisions/${revId}/revert`, {
    ...options,
    method: "POST",
    auth: true,
  });
  return revision;
}

async function withdrawPendingRevision(id: number, options: CallOptions = {}): Promise<RevisionSummary> {
  const { revision } = await unisonFetch<{ revision: RevisionSummary }>(`/lyrics/${id}/revisions/pending`, {
    ...options,
    method: "DELETE",
    auth: true,
  });
  return revision;
}

// -- Videos --------------------------------------------------------------------

async function fetchVideoLinks(id: number, options: CallOptions = {}): Promise<VideoLink[]> {
  const { videos } = await unisonFetch<{ videos: VideoLink[] }>(`/lyrics/${id}/videos`, options);
  return videos;
}

async function linkVideo(id: number, videoId: string, options: CallOptions = {}): Promise<VideoLink[]> {
  const { videos } = await unisonFetch<{ videos: VideoLink[] }>(`/lyrics/${id}/videos`, {
    ...options,
    method: "POST",
    body: { videoId },
    auth: true,
  });
  return videos;
}

async function unlinkVideo(id: number, videoId: string, options: CallOptions = {}): Promise<VideoLink[]> {
  const path = `/lyrics/${id}/videos/${encodeURIComponent(videoId)}`;
  const { videos } = await unisonFetch<{ videos: VideoLink[] }>(path, { ...options, method: "DELETE", auth: true });
  return videos;
}

async function suggestVideosForSong(song: SongForSuggestions, options: CallOptions = {}): Promise<SuggestedVideo[]> {
  const { suggestions } = await unisonFetch<{ suggestions: SuggestedVideo[] }>("/lyrics/suggested-videos", {
    ...options,
    method: "POST",
    body: song,
    auth: true,
  });
  return suggestions;
}

async function suggestVideosForLyric(id: number, options: CallOptions = {}): Promise<LyricVideoSuggestions> {
  const { suggestions, linked } = await unisonFetch<Partial<LyricVideoSuggestions>>(`/lyrics/${id}/suggested-videos`, {
    ...options,
    method: "POST",
    auth: true,
  });
  return { suggestions: suggestions ?? [], linked: linked ?? [] };
}

// -- Leaderboard ---------------------------------------------------------------

// The server returns the unpaged top list unless a cursor is present, so the first page sends an empty one.
function fetchMostWanted({ cursor = "", signal }: PageOptions = {}): Promise<UnisonPage<WantedSong>> {
  return unisonFetchPage("/leaderboard/songs", { signal, query: { cursor } });
}

// -- Exports -------------------------------------------------------------------

export {
  fetchProfile,
  compareWithLive,
  createSession,
  deleteLyrics,
  fetchChallenge,
  fetchLyric,
  fetchMine,
  fetchMostWanted,
  fetchRevision,
  fetchRevisionDiff,
  fetchRevisions,
  fetchVariants,
  fetchVideoLinks,
  linkVideo,
  logout,
  previewRevision,
  revertRevision,
  saveRevision,
  searchLyrics,
  submitLyrics,
  suggestVideosForLyric,
  suggestVideosForSong,
  unlinkVideo,
  withdrawPendingRevision,
};

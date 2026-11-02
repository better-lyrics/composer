// -- Shared --------------------------------------------------------------------

type UnisonLyricsFormat = "ttml" | "lrc" | "plain";
type UnisonSyncType = "richsync" | "linesync" | "plain";
type UnisonConfidence = "low" | "medium" | "high";
type UnisonVote = 1 | -1;
type UnisonTierName = "lyricist" | "elite" | "master" | "grandmaster" | "legendary";

interface UnisonPage<T> {
  items: T[];
  nextCursor: string | null;
}

interface UnisonBadgeRef {
  key: string;
  name: string;
  tier?: number;
}

interface UnisonActor {
  keyId: string;
  displayName: string;
  tier: UnisonTierName | null;
  level: number;
  badgeCount: number;
  topBadge: UnisonBadgeRef | null;
  featured: UnisonBadgeRef[];
  avatarUrl: string | null;
}

interface UnisonSubmitter extends UnisonActor {
  reputation: number;
}

interface UnisonMark {
  type: string;
  label: string;
  icon: string;
  by?: UnisonActor;
  at?: number;
}

// -- Revisions -----------------------------------------------------------------

type PendingReason = "sealed" | "flagged" | "large_text_drift" | "large_timing_drift";

interface RevisionBar {
  revNo: number;
  count: number;
  pending: { revNo: number; pendingReason: PendingReason; textDrift: number; timingDrift: number } | null;
  lastRejected: { revNo: number; reviewNote: string | null } | null;
  updatedAt: number;
}

// -- Lyrics --------------------------------------------------------------------

interface UnisonLyricBase {
  id: number;
  videoId: string;
  song: string;
  artist: string;
  album?: string;
  isrc?: string;
  lyrics: string;
  format: UnisonLyricsFormat;
  language?: string;
  syncType: string;
  score: number;
  effectiveScore: number;
  voteCount: number;
  confidence: UnisonConfidence;
  hidden: boolean;
  submitter?: UnisonSubmitter;
  fulfilled?: { demand: number; requestCount: number; fulfilledAt: number };
  marks?: UnisonMark[];
}

interface UnisonVariant extends UnisonLyricBase {
  userVote: UnisonVote | null;
}

interface UnisonLyric extends UnisonVariant {
  revision: RevisionBar;
}

interface UnisonMineItem {
  id: number;
  videoId: string;
  song: string;
  artist: string;
  album?: string;
  isrc?: string;
  duration: number;
  format: UnisonLyricsFormat;
  language?: string;
  syncType: UnisonSyncType;
  score: number;
  effectiveScore: number;
  voteCount: number;
  confidence: UnisonConfidence;
  createdAt: number;
  hidden: boolean;
  marks?: UnisonMark[];
  submitter?: UnisonActor;
  userVote: UnisonVote | null;
  revision: RevisionBar;
}

interface UnisonSearchResult {
  id: number;
  videoId: string;
  song: string;
  artist: string;
  album?: string;
  isrc?: string;
  duration: number;
  format: UnisonLyricsFormat;
  language?: string;
  syncType: string;
  score: number;
  effectiveScore: number;
  voteCount: number;
  confidence: UnisonConfidence;
  matchScore: number;
  submitter?: UnisonSubmitter;
  marks?: UnisonMark[];
}

interface LyricsSubmission {
  videoId: string;
  song: string;
  artist: string;
  album?: string;
  isrc?: string;
  duration: number;
  lyrics: string;
  format: UnisonLyricsFormat;
  language?: string;
}

interface LyricsSubmissionResult {
  id: number;
  created: boolean;
}

// -- Videos and songs ----------------------------------------------------------

interface VideoLink {
  videoId: string;
  isPrimary: boolean;
}

interface SuggestedVideo {
  videoId: string;
  title: string;
  artist: string;
  artists: string[];
  artistChannelIds: string[];
  album: string | null;
  durationSeconds: number | null;
  videoType: "song" | "video";
  artworkUrl: string | null;
  matchScore: number;
  match: { level: "same" | "related" | "different"; score: number } | null;
}

interface SongForSuggestions {
  song: string;
  artist: string;
  album?: string | null;
  duration: number;
  videoId?: string;
}

interface WantedSong {
  videoId: string;
  song: string;
  artist: string;
  thumbnailUrl: string | null;
  demand: number;
  requestCount: number;
  section: "most_wanted" | "needs_fixing";
  rank: number;
}

// -- Auth ----------------------------------------------------------------------

interface UnisonIdentity {
  keyId: string;
  displayName: string;
  avatarUrl: string | null;
  council: { admin: boolean } | null;
}

interface UnisonMe extends UnisonIdentity {
  expiresAt: number;
}

interface UnisonChallenge {
  nonce: string;
  expiresAt: number;
}

interface UnisonSessionPayload {
  origin: string;
  timestamp: number;
  nonce: string;
  keyId: string;
}

interface UnisonSignedSessionBody {
  payload: UnisonSessionPayload;
  signature: string;
  publicKey?: JsonWebKey;
}

interface UnisonSessionResponse extends UnisonIdentity {
  sessionToken: string;
  expiresAt: number;
}

// -- Exports -------------------------------------------------------------------

export type {
  LyricsSubmission,
  LyricsSubmissionResult,
  PendingReason,
  RevisionBar,
  SongForSuggestions,
  SuggestedVideo,
  UnisonActor,
  UnisonChallenge,
  UnisonIdentity,
  UnisonLyric,
  UnisonLyricsFormat,
  UnisonMark,
  UnisonMe,
  UnisonMineItem,
  UnisonPage,
  UnisonSearchResult,
  UnisonSessionPayload,
  UnisonSessionResponse,
  UnisonSignedSessionBody,
  UnisonVariant,
  UnisonVote,
  VideoLink,
  WantedSong,
};

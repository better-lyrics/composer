// -- Types --------------------------------------------------------------------

interface MbArtistCredit {
  name: string;
  joinphrase?: string;
  artist: { id: string; name: string };
}

interface MbReleaseGroup {
  id: string;
  "primary-type"?: string | null;
  "secondary-types"?: string[];
}

interface MbRelease {
  id: string;
  title: string;
  status?: string | null;
  date?: string;
  "artist-credit"?: MbArtistCredit[];
  "release-group"?: MbReleaseGroup;
}

interface MbWorkRelation {
  type: string;
  "target-type": string;
  "target-credit"?: string;
  artist?: { id: string; name: string };
}

interface MbRecordingRelation {
  type: string;
  "target-type": string;
  work?: { id: string; title: string; relations?: MbWorkRelation[] };
}

interface MbRecording {
  id: string;
  title: string;
  length?: number | null;
  score?: number;
  disambiguation?: string;
  isrcs?: string[];
  "artist-credit"?: MbArtistCredit[];
  releases?: MbRelease[];
  relations?: MbRecordingRelation[];
}

interface MbSearchResponse {
  recordings: MbRecording[];
}

// -- Exports ------------------------------------------------------------------

export type { MbRecording, MbRelease, MbSearchResponse };

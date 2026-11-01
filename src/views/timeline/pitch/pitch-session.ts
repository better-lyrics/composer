import type { PitchTrack } from "@/domain/pitch/track";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types --------------------------------------------------------------------

interface PitchSession {
  track: PitchTrack | null;
  jobKey: string | null;
}

// -- State --------------------------------------------------------------------

// Read every frame by the pitch lane, so it is a plain object; rows follow pitchTrackGeneration.
const pitchSession: PitchSession = { track: null, jobKey: null };

// -- Functions ----------------------------------------------------------------

function publishPitchSession(): void {
  const timeline = useTimelineStore.getState();
  timeline.setPitchTrackGeneration(timeline.pitchTrackGeneration + 1);
}

function setPitchSessionTrack(track: PitchTrack, jobKey: string | null): void {
  pitchSession.track = track;
  pitchSession.jobKey = jobKey;
  publishPitchSession();
}

function clearPitchSession(): void {
  if (!pitchSession.track) return;
  pitchSession.track = null;
  pitchSession.jobKey = null;
  publishPitchSession();
}

// -- Exports ------------------------------------------------------------------

export { clearPitchSession, pitchSession, setPitchSessionTrack };

import type { WantedSong } from "@/lib/unison/api-types";
import { startWantedSong } from "@/lib/unison/start-wanted-song";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

// -- Types ---------------------------------------------------------------------

interface StartWantedSongState {
  startingId: string | null;
  start: (song: WantedSong) => void;
}

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonWanted]";

// -- Hook ----------------------------------------------------------------------

function useStartWantedSong(): StartWantedSongState {
  const navigate = useNavigate();
  const [startingId, setStartingId] = useState<string | null>(null);

  const start = (song: WantedSong) => {
    setStartingId(song.videoId);
    startWantedSong(song, { navigate })
      .catch((error: unknown) => console.error(LOG_PREFIX, "could not start a project", error))
      .finally(() => setStartingId(null));
  };

  return { startingId, start };
}

// -- Exports -------------------------------------------------------------------

export { useStartWantedSong };

import type { WantedSong } from "@/lib/unison/api-types";
import { startVideoProject } from "@/lib/unison/video-project";
import { useProjectStore } from "@/stores/project";

// -- Types ---------------------------------------------------------------------

interface StartWantedSongOptions {
  navigate: (path: string) => void;
}

// -- Starting ------------------------------------------------------------------

function startWantedSong(song: WantedSong, { navigate }: StartWantedSongOptions): Promise<void> {
  return startVideoProject({
    videoId: song.videoId,
    title: song.song || song.videoId,
    prepare: () => {
      if (song.artist) useProjectStore.getState().setMetadata({ artists: [song.artist] });
    },
    navigate,
  });
}

// -- Exports -------------------------------------------------------------------

export { startWantedSong };

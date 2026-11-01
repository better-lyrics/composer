import { YouTubeUrlInput } from "@/audio/youtube-url-input";
import { UNSUPPORTED_AUDIO_FILE_MESSAGE, isSupportedAudioFile } from "@/domain/audio-file/supported-formats";
import { useLoadAudioFile } from "@/hooks/useLoadAudioFile";
import { useLoadYouTubeSource } from "@/hooks/useLoadYouTubeSource";
import { Button } from "@/ui/button";
import { Menu, type MenuAnchor, MenuHeader, MenuItem } from "@/ui/menu";
import { menuTriggerProps } from "@/ui/menu-trigger-props";
import { IconBrandYoutube, IconFileMusic, IconReplace } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

// -- Types --------------------------------------------------------------------

type ReplacePage = "choose" | "youtube";

interface ReplaceAudioMenuProps {
  card: HTMLElement | null;
}

// -- Constants ----------------------------------------------------------------

const KEEPS_TIMING = "Lyrics and timing stay as they are. Use the same recording.";

// -- Component ----------------------------------------------------------------

const ReplaceAudioMenu: React.FC<ReplaceAudioMenuProps> = ({ card }) => {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<ReplacePage>("choose");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadAudioFile = useLoadAudioFile();
  const loadYouTubeSource = useLoadYouTubeSource();
  const anchor: MenuAnchor | null = open && card ? { kind: "element", element: card } : null;

  const toggleMenu = () => {
    if (!open) setPage("choose");
    setOpen(!open);
  };

  const replaceWithFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (isSupportedAudioFile(file)) void loadAudioFile(file, "replace");
    else toast.error(UNSUPPORTED_AUDIO_FILE_MESSAGE);
  };

  const replaceWithVideo = async (videoId: string) => {
    setOpen(false);
    await loadYouTubeSource(videoId, "replace");
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        hasIcon
        {...menuTriggerProps(open)}
        onClick={toggleMenu}
        className="shrink-0"
      >
        <IconReplace aria-hidden="true" className="size-[15px] text-(--muted)" />
        Replace
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        aria-label="Replace audio file"
        hidden
        tabIndex={-1}
        onChange={replaceWithFile}
      />
      <Menu anchor={anchor} align="end" onClose={() => setOpen(false)} aria-label="Replace audio" className="w-75">
        {page === "youtube" ? (
          <>
            <MenuHeader title="Replace with a YouTube video" detail={KEEPS_TIMING} />
            <div className="p-0.5">
              <YouTubeUrlInput
                placeholder="YouTube URL or video ID"
                surface="floating"
                focusOnOpen
                onLoadVideo={replaceWithVideo}
              />
            </div>
          </>
        ) : (
          <>
            <MenuHeader title="Replace the audio" detail={KEEPS_TIMING} />
            <MenuItem
              icon={IconFileMusic}
              label="Choose an audio file…"
              onSelect={() => fileInputRef.current?.click()}
            />
            <MenuItem
              icon={IconBrandYoutube}
              label="Use a YouTube link…"
              onSelect={() => {
                setOpen(true);
                setPage("youtube");
              }}
            />
          </>
        )}
      </Menu>
    </>
  );
};

// -- Exports ------------------------------------------------------------------

export { ReplaceAudioMenu };

import { isYouTubeLoadError, isYouTubeLoadFailure, useLoadYouTubeSource } from "@/hooks/useLoadYouTubeSource";
import { useAudioStore } from "@/stores/audio";
import { Button } from "@/ui/button";
import { INVALID_YOUTUBE_LINK_MESSAGE, extractVideoId } from "@/utils/youtube-url";
import { IconBrandYoutube, IconLoader2 } from "@tabler/icons-react";
import { useCallback, useState } from "react";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[YouTubeUrlInput]";

// -- Component ----------------------------------------------------------------

interface YouTubeUrlInputProps {
  placeholder?: string;
  className?: string;
  onLoadVideo?: (videoId: string) => Promise<void>;
}

const YouTubeUrlInput: React.FC<YouTubeUrlInputProps> = ({
  placeholder = "Paste YouTube URL or video ID",
  className,
  onLoadVideo,
}) => {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isLoading = useAudioStore((s) => s.isLoading);
  const youtubeLoadError = useAudioStore((s) => s.youtubeLoadError);
  const loadYouTubeSource = useLoadYouTubeSource();

  const handleSubmit = useCallback(async () => {
    const videoId = extractVideoId(value);
    if (!videoId) {
      setError(INVALID_YOUTUBE_LINK_MESSAGE);
      return;
    }
    setError(null);
    try {
      await (onLoadVideo ?? loadYouTubeSource)(videoId);
      setValue("");
    } catch (error) {
      if (isYouTubeLoadError(error) && !isYouTubeLoadFailure(error)) {
        console.info(LOG_PREFIX, "ignored a superseded video load", error);
        return;
      }
      if (!isYouTubeLoadError(error)) console.error(LOG_PREFIX, "could not load the video", error);
    }
  }, [value, loadYouTubeSource, onLoadVideo]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
    e.stopPropagation();
  };

  const trimmed = value.trim();

  return (
    <div className={`flex flex-col gap-1.5 w-full max-w-md ${className ?? ""}`}>
      <div className="flex gap-2">
        <input
          type="text"
          aria-label="YouTube URL or video ID"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
            if (youtubeLoadError) useAudioStore.getState().setYouTubeLoadError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          className="flex-1 h-8 px-3 text-sm rounded-md bg-composer-input border border-composer-border focus:outline-none focus:border-composer-accent cursor-text disabled:opacity-50 select-text"
        />
        <Button variant="primary" hasIcon onClick={handleSubmit} disabled={isLoading || trimmed.length === 0}>
          {isLoading ? <IconLoader2 size={16} className="animate-spin" /> : <IconBrandYoutube size={16} />}
          {isLoading ? "Loading" : "Load"}
        </Button>
      </div>
      {error && <p className="text-xs text-red-400 select-text">{error}</p>}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { YouTubeUrlInput };

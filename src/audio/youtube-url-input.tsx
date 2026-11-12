import type { YouTubeDownloadProgress } from "@/audio/youtube-download";
import {
  isYouTubeLoadCancelled,
  isYouTubeLoadError,
  isYouTubeLoadFailure,
  useLoadYouTubeSource,
} from "@/hooks/useLoadYouTubeSource";
import { useFieldError } from "@/hooks/useFieldError";
import { useYouTubeDownload } from "@/hooks/useYouTubeDownload";
import { useAudioStore } from "@/stores/audio";
import { Button } from "@/ui/button";
import { DelayedSpinner } from "@/ui/delayed-spinner";
import { FieldError } from "@/ui/field-error";
import { FLOATING_INPUT_STYLES, INPUT_STYLES } from "@/ui/input-styles";
import { ProgressBar } from "@/ui/progress-bar";
import { cn } from "@/utils/cn";
import { focusOnMount } from "@/utils/focus-on-mount";
import { EMPTY_YOUTUBE_LINK_MESSAGE, INVALID_YOUTUBE_LINK_MESSAGE, extractVideoId } from "@/utils/youtube-url";
import { IconBrandYoutube, IconX } from "@tabler/icons-react";
import { useCallback, useState } from "react";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[YouTubeUrlInput]";
const PROGRESS_TRACK = "h-1.5 bg-(--well) shadow-(--well-edge)";

// -- Components ---------------------------------------------------------------

const DownloadProgress: React.FC<{ progress: YouTubeDownloadProgress | null }> = ({ progress }) => (
  <div className="flex flex-col gap-1.5">
    {progress?.percent != null ? (
      <ProgressBar percent={progress.percent} label="YouTube download" className={PROGRESS_TRACK} />
    ) : (
      <div className={cn("rounded-full", PROGRESS_TRACK)} />
    )}
    <span className="h-4 text-xs text-(--muted) tabular-nums">{progress?.label}</span>
  </div>
);

interface YouTubeUrlInputProps {
  placeholder?: string;
  className?: string;
  onLoadVideo?: (videoId: string) => Promise<void>;
  surface?: "well" | "floating";
  focusOnOpen?: boolean;
}

const YouTubeUrlInput: React.FC<YouTubeUrlInputProps> = ({
  placeholder = "Paste YouTube URL or video ID",
  className,
  onLoadVideo,
  surface = "well",
  focusOnOpen = false,
}) => {
  const [value, setValue] = useState("");
  const linkField = useFieldError();
  const { showError, clearError } = linkField;
  const isLoading = useAudioStore((s) => s.isLoading);
  const youtubeLoadError = useAudioStore((s) => s.youtubeLoadError);
  const loadYouTubeSource = useLoadYouTubeSource();
  const download = useYouTubeDownload();

  const handleSubmit = useCallback(async () => {
    if (value.trim() === "") {
      showError(EMPTY_YOUTUBE_LINK_MESSAGE);
      return;
    }
    const videoId = extractVideoId(value);
    if (!videoId) {
      showError(INVALID_YOUTUBE_LINK_MESSAGE);
      return;
    }
    clearError();
    try {
      await (onLoadVideo ?? loadYouTubeSource)(videoId);
      setValue("");
    } catch (error) {
      if (isYouTubeLoadCancelled(error)) return;
      if (isYouTubeLoadError(error) && !isYouTubeLoadFailure(error)) {
        console.info(LOG_PREFIX, "ignored a superseded video load", error);
        return;
      }
      if (!isYouTubeLoadError(error)) console.error(LOG_PREFIX, "could not load the video", error);
    }
  }, [value, loadYouTubeSource, onLoadVideo, showError, clearError]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key !== "Escape" || surface !== "floating") e.stopPropagation();
  };

  return (
    <div className={cn("flex flex-col gap-1.5 w-full", className)}>
      <div className="flex gap-2">
        <input
          type="text"
          aria-label="YouTube URL or video ID"
          {...linkField.fieldProps}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            clearError();
            if (youtubeLoadError) useAudioStore.getState().setYouTubeLoadError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          ref={focusOnOpen ? focusOnMount : undefined}
          className={cn(surface === "floating" ? FLOATING_INPUT_STYLES : INPUT_STYLES, "flex-1 h-9 select-text")}
        />
        {download.downloading ? (
          <Button variant="secondary" size="lg" hasIcon onClick={download.cancel} className="rounded-lg">
            <IconX size={16} />
            Cancel
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            hasIcon
            onClick={handleSubmit}
            disabled={isLoading}
            className="rounded-lg"
          >
            <DelayedSpinner busy={isLoading} className="size-4" idle={<IconBrandYoutube size={16} />} />
            Load
          </Button>
        )}
      </div>
      {download.downloading && <DownloadProgress progress={download.progress} />}
      <FieldError {...linkField.errorProps} />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { YouTubeUrlInput };

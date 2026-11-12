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
import { readYouTubeLink } from "@/utils/youtube-url";
import { IconBrandYoutube, IconX } from "@tabler/icons-react";
import { useCallback, useState } from "react";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[YouTubeUrlInput]";

// -- Components ---------------------------------------------------------------

const FieldDownloadProgress: React.FC<{ progress: YouTubeDownloadProgress | null }> = ({ progress }) => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
    <span className="absolute inset-y-0 right-3 flex items-center text-xs text-(--muted) tabular-nums">
      {progress?.label}
    </span>
    {progress?.percent != null && (
      <ProgressBar
        percent={progress.percent}
        label="YouTube download"
        className="absolute inset-x-0 bottom-0 h-0.5 rounded-none bg-transparent"
      />
    )}
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
    const { videoId, error } = readYouTubeLink(value);
    if (error !== undefined) {
      showError(error);
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
        <div className="relative flex-1">
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
            className={cn(
              surface === "floating" ? FLOATING_INPUT_STYLES : INPUT_STYLES,
              "w-full h-9 select-text",
              download.downloading && "pr-28",
            )}
          />
          {download.downloading && <FieldDownloadProgress progress={download.progress} />}
        </div>
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
      <FieldError {...linkField.errorProps} />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { YouTubeUrlInput };

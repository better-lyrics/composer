import { useCallback, useMemo, useRef, useState } from "react";
import type { LyricsSearchResult } from "@/domain/lyrics-search/result";
import { useLyricsSearch } from "@/hooks/useLyricsSearch";
import type { LyricsSearchQuery } from "@/utils/lyrics-search/types";
import { formatDuration, parseDurationInput } from "@/views/lyrics-import-modal/duration-input-utils";
import { ResultRow } from "@/views/lyrics-import-modal/result-row";
import { SearchField } from "@/views/lyrics-import-modal/search-field";
import {
  IconAlbum,
  IconBrandYoutube,
  IconClock,
  IconFileText,
  IconMicrophone,
  IconSearch,
  IconUpload,
  IconUser,
} from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface SearchSectionProps {
  initialPrefill: LyricsSearchQuery | null;
  expectedDurationSec?: number;
  onSelect: (result: LyricsSearchResult) => void;
  onSwitchToPaste: () => void;
  onSwitchToUpload: () => void;
}

interface InputState {
  track: string;
  artist: string;
  album: string;
  duration: string;
  videoId: string;
}

// -- Constants ----------------------------------------------------------------

const SKELETON_ROW_COUNT = 3;
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  lrclib: "LRCLib",
  binimum: "Binimum",
  "boidu-lyrics": "Better Lyrics",
};

// -- Helpers ------------------------------------------------------------------

function buildInitialInputState(prefill: LyricsSearchQuery | null): InputState {
  return {
    track: prefill?.track ?? "",
    artist: prefill?.artist ?? "",
    album: prefill?.album ?? "",
    duration: typeof prefill?.durationSec === "number" ? formatDuration(prefill.durationSec) : "",
    videoId: prefill?.videoId ?? "",
  };
}

function buildQuery(inputs: InputState, isrc: string | undefined): LyricsSearchQuery {
  return {
    track: inputs.track.trim() || undefined,
    artist: inputs.artist.trim() || undefined,
    album: inputs.album.trim() || undefined,
    durationSec: parseDurationInput(inputs.duration),
    videoId: inputs.videoId.trim() || undefined,
    isrc,
  };
}

function formatProviderName(name: string): string {
  return PROVIDER_DISPLAY_NAMES[name] ?? name;
}

// -- Component ----------------------------------------------------------------

const SearchSection: React.FC<SearchSectionProps> = ({
  initialPrefill,
  expectedDurationSec,
  onSelect,
  onSwitchToPaste,
  onSwitchToUpload,
}) => {
  const [inputs, setInputs] = useState<InputState>(() => buildInitialInputState(initialPrefill));
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const trackInputRef = useRef<HTMLInputElement>(null);
  const isrcRef = useRef(initialPrefill?.isrc);

  const query = useMemo(() => buildQuery(inputs, isrcRef.current), [inputs]);
  const { results, isFetching, errors } = useLyricsSearch(query);

  const effectiveExpectedDuration = expectedDurationSec ?? parseDurationInput(inputs.duration);

  const handleDurationBlur = useCallback(() => {
    const parsed = parseDurationInput(inputs.duration);
    if (parsed === undefined) return;
    const formatted = formatDuration(parsed);
    if (formatted !== inputs.duration) {
      setInputs((prev) => ({ ...prev, duration: formatted }));
    }
  }, [inputs.duration]);

  const handleInputChange = useCallback(<K extends keyof InputState>(key: K) => {
    return (value: string) => {
      setInputs((prev) => ({ ...prev, [key]: value }));
      setFocusedIndex(-1);
    };
  }, []);

  const handleSelectResult = useCallback(
    (result: LyricsSearchResult) => {
      setSelectingId(result.id);
      onSelect(result);
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (results.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, results.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        if (focusedIndex < 0) return;
        e.preventDefault();
        const target = results[focusedIndex];
        if (!target) return;
        handleSelectResult(target);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setFocusedIndex(-1);
        trackInputRef.current?.focus();
      }
    },
    [results, focusedIndex, handleSelectResult],
  );

  const renderResults = () => {
    if (errors.size > 0 && results.length === 0 && !isFetching) {
      return (
        <div className="flex flex-col items-center gap-1.5 py-8 text-center" role="alert">
          <span className="text-xs text-composer-error-text">
            {[...errors.values()].map((err) => `${formatProviderName(err.provider)}: ${err.message}`).join(" ・ ")}
          </span>
          <span className="text-[11px] text-composer-text-muted">Try adjusting your search.</span>
        </div>
      );
    }
    if (results.length > 0) {
      return (
        <div role="listbox" className="flex flex-col gap-1.5">
          {results.map((result, index) => (
            <ResultRow
              key={result.id}
              result={result}
              isHovered={hoveredIndex === index}
              isFocused={focusedIndex === index}
              isSelecting={selectingId === result.id}
              expectedDurationSec={effectiveExpectedDuration}
              onHover={() => setHoveredIndex(index)}
              onSelect={() => handleSelectResult(result)}
            />
          ))}
        </div>
      );
    }
    if (isFetching) {
      return (
        <div className="flex flex-col gap-1.5" aria-busy="true">
          {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-count decorative skeleton
              key={i}
              data-testid="result-skeleton"
              className="grid grid-cols-[24px_1fr_auto] items-center gap-3 px-3 py-2.5 rounded-lg animate-pulse"
            >
              <span className="size-6 rounded-md bg-white/4" />
              <span className="h-3 rounded bg-white/4 w-3/4" />
              <span className="h-3 rounded bg-white/4 w-12" />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-2 py-9 px-4 text-center">
        <IconSearch size={22} className="text-composer-text opacity-25" aria-hidden="true" />
        <span className="text-xs font-medium text-composer-text-secondary">Type a track or paste a video ID</span>
        <span className="text-[11px] text-composer-text-muted">
          Artist narrows results. Album, duration, video ID are optional but help.
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4" onKeyDown={handleKeyDown}>
      <div className="grid grid-cols-[1.4fr_1fr] gap-2">
        <SearchField
          label="Track"
          icon={<IconMicrophone size={14} stroke={1.75} />}
          value={inputs.track}
          placeholder="Bohemian Rhapsody"
          onChange={handleInputChange("track")}
          inputRef={trackInputRef}
        />
        <SearchField
          label="Artist"
          icon={<IconUser size={14} stroke={1.75} />}
          value={inputs.artist}
          placeholder="Queen"
          onChange={handleInputChange("artist")}
        />
        <SearchField
          label="Album"
          optional
          icon={<IconAlbum size={14} stroke={1.75} />}
          value={inputs.album}
          placeholder="A Night at the Opera"
          onChange={handleInputChange("album")}
        />
        <SearchField
          label="Duration"
          optional
          mono
          icon={<IconClock size={14} stroke={1.75} />}
          value={inputs.duration}
          placeholder="3:45"
          onChange={handleInputChange("duration")}
          onBlur={handleDurationBlur}
        />
        <SearchField
          label="Video ID"
          optional
          mono
          fullWidth
          icon={<IconBrandYoutube size={14} stroke={1.75} />}
          value={inputs.videoId}
          placeholder="dQw4w9WgXcQ"
          onChange={handleInputChange("videoId")}
        />
      </div>

      <div className="flex flex-col gap-1.5 p-1.5 bg-composer-input border border-composer-border rounded-xl min-h-[168px]">
        {renderResults()}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onSwitchToPaste}
          className="inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-composer-input border border-composer-border rounded-lg text-composer-text-secondary text-xs font-medium cursor-pointer hover:bg-composer-button-hover hover:text-composer-text transition-colors"
        >
          <IconFileText size={14} stroke={1.75} className="text-composer-text opacity-50" />
          Paste lyrics instead
        </button>
        <button
          type="button"
          onClick={onSwitchToUpload}
          className="inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-composer-input border border-composer-border rounded-lg text-composer-text-secondary text-xs font-medium cursor-pointer hover:bg-composer-button-hover hover:text-composer-text transition-colors"
        >
          <IconUpload size={14} stroke={1.75} className="text-composer-text opacity-50" />
          Upload file
        </button>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { SearchSection };
export type { SearchSectionProps };

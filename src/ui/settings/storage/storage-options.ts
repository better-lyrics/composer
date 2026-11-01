import type { KeepYouTubeAudio } from "@/domain/storage/audio-retention";
import type { StorageLimit } from "@/domain/storage/storage-limit";
import type { AudioFilter } from "@/domain/storage/stored-audio";
import type { SegmentedOption } from "@/ui/segmented-control";

// -- Options ------------------------------------------------------------------

const KEEP_YOUTUBE_AUDIO_OPTIONS: { value: KeepYouTubeAudio; label: string }[] = [
  { value: "auto", label: "Automatic" },
  { value: "always", label: "Always" },
  { value: "never", label: "Never" },
];

const STORAGE_LIMIT_OPTIONS: { value: StorageLimit; label: string }[] = [
  { value: "1gb", label: "1 GB" },
  { value: "2gb", label: "2 GB" },
  { value: "5gb", label: "5 GB" },
  { value: "none", label: "No limit" },
];

const AUDIO_FILTER_OPTIONS: readonly SegmentedOption<AudioFilter>[] = [
  { value: "all", label: "All" },
  { value: "local", label: "Local" },
  { value: "youtube", label: "YouTube" },
];

// -- Exports -------------------------------------------------------------------

export { AUDIO_FILTER_OPTIONS, KEEP_YOUTUBE_AUDIO_OPTIONS, STORAGE_LIMIT_OPTIONS };

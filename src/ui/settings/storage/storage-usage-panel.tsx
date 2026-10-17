import type { StorageUsage } from "@/domain/storage/usage";
import { cn } from "@/utils/cn";
import { formatApproximateFileSize, formatFileSize } from "@/utils/format-file-size";

// -- Types --------------------------------------------------------------------

interface StorageUsagePanelProps {
  usage: StorageUsage;
  freeBytes: number | undefined;
  youtubeKept: boolean;
}

type UsageCategoryKey = "localAudioBytes" | "youtubeAudioBytes" | "stemBytes" | "lyricsBytes";

interface UsageCategory {
  key: UsageCategoryKey;
  label: string;
  swatch: string;
}

// -- Constants ----------------------------------------------------------------

const NOT_STORED = "Not stored";

const USAGE_CATEGORIES: readonly UsageCategory[] = [
  { key: "localAudioBytes", label: "Local audio", swatch: "bg-composer-accent" },
  { key: "youtubeAudioBytes", label: "YouTube audio", swatch: "bg-composer-accent-text" },
  { key: "stemBytes", label: "Vocal stems", swatch: "bg-composer-positive" },
  { key: "lyricsBytes", label: "Lyrics and timings", swatch: "bg-composer-text/70" },
];

// -- Helpers ------------------------------------------------------------------

function isNotStored(category: UsageCategory, usage: StorageUsage, youtubeKept: boolean): boolean {
  return category.key === "youtubeAudioBytes" && !youtubeKept && usage.youtubeAudioBytes === 0;
}

function categoryValue(category: UsageCategory, usage: StorageUsage, youtubeKept: boolean): string {
  return isNotStored(category, usage, youtubeKept) ? NOT_STORED : formatFileSize(usage[category.key]);
}

// -- Component ----------------------------------------------------------------

const StorageUsagePanel: React.FC<StorageUsagePanelProps> = ({ usage, freeBytes, youtubeKept }) => {
  const barLabel = `Storage used: ${USAGE_CATEGORIES.map((category) => `${category.label} ${categoryValue(category, usage, youtubeKept)}`).join(", ")}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xl font-bold tabular-nums text-composer-text select-text">
          {formatFileSize(usage.totalBytes)}
          <small className="ms-1.5 text-[13px] font-normal text-composer-text-muted select-none">
            used on this device
          </small>
        </span>
        {freeBytes !== undefined && (
          <span className="text-[13px] text-composer-text-muted select-text">
            About {formatApproximateFileSize(freeBytes)} free
          </span>
        )}
      </div>
      <div
        role="img"
        aria-label={barLabel}
        className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-composer-button"
      >
        {USAGE_CATEGORIES.filter((category) => usage[category.key] > 0).map((category) => (
          <span
            key={category.key}
            className={cn("h-full", category.swatch)}
            style={{ width: `${(usage[category.key] / usage.totalBytes) * 100}%` }}
          />
        ))}
      </div>
      <dl className="m-0 grid grid-cols-4 gap-3">
        {USAGE_CATEGORIES.map((category) => (
          <div key={category.key} className="flex flex-col gap-0.5 text-xs">
            <dt className="flex items-center gap-1.5 text-composer-text-muted select-none">
              <span aria-hidden="true" className={cn("size-2 rounded-[2px]", category.swatch)} />
              {category.label}
            </dt>
            <dd
              className={cn(
                "m-0 text-sm tabular-nums select-text",
                isNotStored(category, usage, youtubeKept)
                  ? "font-normal text-composer-text-muted"
                  : "font-medium text-composer-text",
              )}
            >
              {categoryValue(category, usage, youtubeKept)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { StorageUsagePanel };

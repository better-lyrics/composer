import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { isValidIsrc, normalizeIsrc } from "@/utils/isrc";
import { INPUT_STYLES, MetadataFieldList } from "@/views/export/metadata-field-list";
import { IconChevronDown, IconChevronRight, IconPlus, IconX } from "@tabler/icons-react";
import { useState } from "react";

// -- Helpers ------------------------------------------------------------------

type ExtraPair = { key: string; value: string };

function pairsToRecord(pairs: ExtraPair[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const { key, value } of pairs) {
    if (key.trim() !== "") record[key] = value;
  }
  return record;
}

// -- Component ----------------------------------------------------------------

const MetadataPanel: React.FC = () => {
  const metadata = useProjectStore((s) => s.metadata);
  const setMetadata = useProjectStore((s) => s.setMetadata);

  const [open, setOpen] = useState(false);
  const [isrcText, setIsrcText] = useState(() => metadata.isrc ?? "");
  const [syncedIsrc, setSyncedIsrc] = useState(metadata.isrc);
  const [extraPairs, setExtraPairs] = useState<ExtraPair[]>(() =>
    Object.entries(metadata.extra ?? {}).map(([key, value]) => ({ key, value })),
  );

  // Re-seed the local field when isrc is written from outside (URL params,
  // bridge, audio tags), without disturbing an in-progress edit: our own writes
  // advance syncedIsrc in step, so only external writes trip this. extra is
  // panel-only, so it needs no equivalent sync.
  if (metadata.isrc !== syncedIsrc) {
    setSyncedIsrc(metadata.isrc);
    setIsrcText(metadata.isrc ?? "");
  }

  const trimmedIsrc = isrcText.trim();
  const isrcInvalid = trimmedIsrc !== "" && !isValidIsrc(trimmedIsrc);

  const handleIsrcChange = (value: string) => {
    setIsrcText(value);
    const normalized = normalizeIsrc(value);
    setMetadata({ isrc: normalized });
    setSyncedIsrc(normalized);
  };

  const handleExtraChange = (next: ExtraPair[]) => {
    setExtraPairs(next);
    setMetadata({ extra: pairsToRecord(next) });
  };

  const handleExtraEdit = (index: number, patch: Partial<ExtraPair>) => {
    handleExtraChange(extraPairs.map((pair, i) => (i === index ? { ...pair, ...patch } : pair)));
  };

  const ChevronIcon = open ? IconChevronDown : IconChevronRight;

  return (
    <div className="border-b border-composer-border">
      <Button
        hasIcon
        variant="ghost"
        size="md"
        className="w-full justify-start rounded-none px-6 py-3 text-composer-text-secondary"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <ChevronIcon className="size-4" />
        Metadata
      </Button>

      {open && (
        <div className="flex flex-col gap-4 px-6 pb-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-composer-text-secondary select-none">Title</span>
            <input
              type="text"
              aria-label="Title"
              value={metadata.title}
              placeholder="Song title"
              onChange={(e) => setMetadata({ title: e.target.value })}
              className={INPUT_STYLES}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-composer-text-secondary select-none">Album</span>
            <input
              type="text"
              aria-label="Album"
              value={metadata.album}
              placeholder="Album name"
              onChange={(e) => setMetadata({ album: e.target.value })}
              className={INPUT_STYLES}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-composer-text-secondary select-none">ISRC</span>
            <input
              type="text"
              aria-label="ISRC"
              value={isrcText}
              placeholder="e.g. USQX91700001"
              onChange={(e) => handleIsrcChange(e.target.value)}
              className={INPUT_STYLES}
            />
            {isrcInvalid && (
              <span className="text-xs text-composer-error-text select-none">
                Invalid ISRC ・ expected 12 characters like USQX91700001
              </span>
            )}
          </label>

          <MetadataFieldList
            label="Artists"
            itemNoun="Artist"
            placeholder="Artist name"
            values={metadata.artists}
            onChange={(next) => setMetadata({ artists: next })}
          />

          <MetadataFieldList
            label="Producers"
            itemNoun="Producer"
            placeholder="Producer name"
            values={metadata.songwriters ?? []}
            onChange={(next) => setMetadata({ songwriters: next })}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-composer-text-secondary select-none">Extra fields</span>
            {extraPairs.map((pair, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional, identity follows index
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  aria-label={`Field ${index + 1} key`}
                  value={pair.key}
                  placeholder="Key"
                  onChange={(e) => handleExtraEdit(index, { key: e.target.value })}
                  className={INPUT_STYLES}
                />
                <input
                  type="text"
                  aria-label={`Field ${index + 1} value`}
                  value={pair.value}
                  placeholder="Value"
                  onChange={(e) => handleExtraEdit(index, { value: e.target.value })}
                  className={INPUT_STYLES}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove field ${index + 1}`}
                  onClick={() => handleExtraChange(extraPairs.filter((_, i) => i !== index))}
                >
                  <IconX className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              hasIcon
              size="sm"
              variant="ghost"
              className="self-start"
              aria-label="Add field"
              onClick={() => handleExtraChange([...extraPairs, { key: "", value: "" }])}
            >
              <IconPlus className="size-3.5" />
              Add field
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { MetadataPanel };

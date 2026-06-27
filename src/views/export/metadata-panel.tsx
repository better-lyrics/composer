import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { accordionTransition, accordionVariants } from "@/utils/animationVariants";
import { cn } from "@/utils/cn";
import { isValidIsrc, normalizeIsrc } from "@/utils/isrc";
import { ExtraFieldList } from "@/views/export/extra-field-list";
import { INPUT_STYLES, MetadataFieldList } from "@/views/export/metadata-field-list";
import { IconChevronRight } from "@tabler/icons-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useState } from "react";

// -- Component ----------------------------------------------------------------

const MetadataPanel: React.FC = () => {
  const metadata = useProjectStore((s) => s.metadata);
  const setMetadata = useProjectStore((s) => s.setMetadata);

  const [open, setOpen] = useState(false);
  const [isrcDraft, setIsrcDraft] = useState(() => metadata.isrc ?? "");

  // The store keeps only a normalized isrc, but the field must show the raw draft
  // while editing (so the invalid hint can appear). Show the draft as long as it
  // still maps to the stored value; if isrc is written from outside (URL params,
  // bridge, audio tags), the store wins and the field re-seeds.
  const isrcValue = normalizeIsrc(isrcDraft) === metadata.isrc ? isrcDraft : (metadata.isrc ?? "");
  const trimmedIsrc = isrcValue.trim();
  const isrcInvalid = trimmedIsrc !== "" && !isValidIsrc(trimmedIsrc);

  const handleIsrcChange = (value: string) => {
    setIsrcDraft(value);
    setMetadata({ isrc: normalizeIsrc(value) });
  };

  const reducedMotion = useReducedMotion();

  return (
    <div className="border-b border-composer-border">
      <Button
        hasIcon
        variant="ghost"
        size="md"
        className="w-full justify-start rounded-none h-8 px-6 text-composer-text-secondary"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <IconChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
        Metadata
      </Button>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="metadata-content"
            variants={accordionVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={reducedMotion ? { duration: 0 } : accordionTransition}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-4 px-6 pt-4 pb-4">
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
                  value={isrcValue}
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

              <ExtraFieldList values={metadata.extra ?? {}} onChange={(next) => setMetadata({ extra: next })} />
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { MetadataPanel };

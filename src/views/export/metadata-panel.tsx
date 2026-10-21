import { isValidLanguageTag, normalizeLanguageTag } from "@/domain/project/language";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { INPUT_STYLES } from "@/ui/input-styles";
import { Scroll } from "@/ui/scroll";
import { accordionTransition, accordionVariants } from "@/utils/animationVariants";
import { cn } from "@/utils/cn";
import { isValidIsrc, normalizeIsrc } from "@/utils/isrc";
import { ExtraFieldList } from "@/views/export/extra-field-list";
import { MetadataFieldList } from "@/views/export/metadata-field-list";
import { MatchStrip } from "@/views/export/musicbrainz/match-strip";
import { MusicBrainzFooter } from "@/views/export/musicbrainz/musicbrainz-footer";
import { MusicBrainzHeaderSlot } from "@/views/export/musicbrainz/musicbrainz-header-slot";
import { SuggestedField } from "@/views/export/musicbrainz/suggested-value";
import { useMusicBrainzPanel } from "@/views/export/musicbrainz/use-musicbrainz-panel";
import { useNormalizedDraft } from "@/views/export/use-normalized-draft";
import { IconChevronRight } from "@tabler/icons-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useId, useState } from "react";

// -- Component ----------------------------------------------------------------

const MetadataPanel: React.FC = () => {
  const metadata = useProjectStore((s) => s.metadata);
  const setMetadata = useProjectStore((s) => s.setMetadata);

  const languageHintId = useId();
  const [open, setOpen] = useState(false);
  const [isrcValue, setIsrcDraft] = useNormalizedDraft(metadata.isrc, normalizeIsrc);
  const trimmedIsrc = isrcValue.trim();
  const isrcInvalid = trimmedIsrc !== "" && !isValidIsrc(trimmedIsrc);

  const handleIsrcChange = (value: string) => {
    setIsrcDraft(value);
    setMetadata({ isrc: normalizeIsrc(value) });
  };

  const [languageValue, setLanguageDraft] = useNormalizedDraft(metadata.language, normalizeLanguageTag);
  const trimmedLanguage = languageValue.trim();
  const languageInvalid = trimmedLanguage !== "" && !isValidLanguageTag(trimmedLanguage);

  const handleLanguageChange = (value: string) => {
    setLanguageDraft(value);
    setMetadata({ language: normalizeLanguageTag(value) });
  };

  const reducedMotion = useReducedMotion();
  const musicBrainz = useMusicBrainzPanel();
  const { shown, suggestions } = musicBrainz;

  return (
    <div className="flex flex-col min-h-0 max-h-[60%] border-b border-composer-border">
      <div className="flex h-8 shrink-0 items-center gap-1 pr-2">
        <Button
          hasIcon
          variant="ghost"
          size="md"
          className="h-8 min-w-0 flex-1 justify-start rounded-none px-6 text-composer-text-secondary"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          <IconChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
          Metadata
        </Button>
        <MusicBrainzHeaderSlot panel={musicBrainz} onReview={() => setOpen(true)} />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="metadata-content"
            variants={accordionVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={reducedMotion ? { duration: 0 } : accordionTransition}
            className="flex flex-col min-h-0 overflow-hidden"
          >
            <Scroll className="flex-1 min-h-0">
              <div className="flex flex-col gap-4 px-6 pt-4 pb-4">
                {shown && (
                  <MatchStrip
                    matches={shown.match.matches}
                    chosen={shown.match.chosen}
                    details={shown.details}
                    onChoose={musicBrainz.choose}
                  />
                )}

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-composer-text-secondary select-none">Title</span>
                  <input
                    type="text"
                    aria-label="Title"
                    value={metadata.title}
                    placeholder="Song title"
                    onChange={(e) => setMetadata({ title: e.target.value })}
                    className={cn("flex-1", INPUT_STYLES)}
                  />
                </label>

                <SuggestedField
                  fieldName="Album"
                  value={metadata.album}
                  placeholder="Album name"
                  onChange={(e) => setMetadata({ album: e.target.value })}
                  suggestion={suggestions.album}
                  onUseSuggestion={(album) => setMetadata({ album })}
                />

                <SuggestedField
                  fieldName="ISRC"
                  aria-invalid={isrcInvalid}
                  value={isrcValue}
                  placeholder="e.g. USQX91700001"
                  onChange={(e) => handleIsrcChange(e.target.value)}
                  suggestion={suggestions.isrc}
                  onUseSuggestion={handleIsrcChange}
                >
                  {isrcInvalid && (
                    <span role="alert" className="text-xs text-composer-error-text select-text cursor-text">
                      Invalid ISRC ・ expected 12 characters like USQX91700001
                    </span>
                  )}
                </SuggestedField>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-composer-text-secondary select-none">Language</span>
                  <input
                    type="text"
                    aria-label="Language"
                    aria-describedby={languageHintId}
                    aria-invalid={languageInvalid}
                    value={languageValue}
                    placeholder="e.g. en, ja, pt-BR"
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className={cn("flex-1", INPUT_STYLES)}
                  />
                  {languageInvalid && (
                    <span role="alert" className="text-xs text-composer-error-text select-text cursor-text">
                      Invalid language ・ expected a BCP-47 tag like en or pt-BR
                    </span>
                  )}
                  <span id={languageHintId} className="text-xs text-composer-text-muted select-none">
                    BCP-47 tag ・ leave blank to let players detect it
                  </span>
                </label>

                <MetadataFieldList
                  label="Artists"
                  itemNoun="Artist"
                  placeholder="Artist name"
                  values={metadata.artists}
                  onChange={(next) => setMetadata({ artists: next })}
                  suggestion={suggestions.artists}
                  onUseSuggestion={(artists) => setMetadata({ artists })}
                />

                <MetadataFieldList
                  label="Songwriters"
                  itemNoun="Songwriter"
                  placeholder="Songwriter name"
                  values={metadata.songwriters ?? []}
                  onChange={(next) => setMetadata({ songwriters: next })}
                  suggestion={suggestions.songwriters}
                  onUseSuggestion={(songwriters) => setMetadata({ songwriters })}
                />

                <ExtraFieldList values={metadata.extra ?? {}} onChange={(next) => setMetadata({ extra: next })} />
              </div>
            </Scroll>
            {shown && (
              <MusicBrainzFooter
                recordingId={shown.match.chosen.recording.id}
                fillCount={musicBrainz.fillCount}
                onDismiss={musicBrainz.dismiss}
                onFill={musicBrainz.fillAll}
              />
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { MetadataPanel };

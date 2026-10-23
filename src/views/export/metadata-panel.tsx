import { isValidLanguageTag, normalizeLanguageTag } from "@/domain/project/language";
import { useProjectStore } from "@/stores/project";
import { Scroll } from "@/ui/scroll";
import { isValidIsrc, normalizeIsrc } from "@/utils/isrc";
import { ExtraFieldList } from "@/views/export/extra-field-list";
import { MetadataFieldList } from "@/views/export/metadata-field-list";
import { MatchStrip } from "@/views/export/musicbrainz/match-strip";
import { MusicBrainzFooter } from "@/views/export/musicbrainz/musicbrainz-footer";
import { MusicBrainzHeaderSlot } from "@/views/export/musicbrainz/musicbrainz-header-slot";
import { SuggestedField } from "@/views/export/musicbrainz/suggested-value";
import { useMusicBrainzPanel } from "@/views/export/musicbrainz/use-musicbrainz-panel";
import { DETAILS_FIELD_STYLES, DETAILS_LABEL_STYLES } from "@/views/export/song-details-styles";
import { useNormalizedDraft } from "@/views/export/use-normalized-draft";
import { useId, useRef } from "react";

// -- Component ----------------------------------------------------------------

const MetadataPanel: React.FC = () => {
  const metadata = useProjectStore((s) => s.metadata);
  const setMetadata = useProjectStore((s) => s.setMetadata);

  const languageHintId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  // These actions unmount the button that ran them, so focus moves to the stable panel title.
  const thenFocusTitle = (action: () => void) => () => {
    action();
    titleRef.current?.focus();
  };
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

  const musicBrainz = useMusicBrainzPanel();
  const { shown, suggestions } = musicBrainz;

  return (
    <aside aria-label="Song details" className="flex flex-col min-h-0 border-l border-(--divider)">
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 pl-4 pr-3 shadow-[inset_0_-1px_0_var(--divider)]">
        <h3 ref={titleRef} tabIndex={-1} className="text-sm font-bold text-composer-text outline-none select-none">
          Song details
        </h3>
        <MusicBrainzHeaderSlot panel={musicBrainz} onRequest={thenFocusTitle(musicBrainz.request)} />
      </div>

      <Scroll className="flex-1 min-h-0">
        <div className="flex flex-col gap-4 p-4">
          {shown && (
            <MatchStrip
              matches={shown.match.matches}
              chosen={shown.match.chosen}
              details={shown.details}
              onChoose={musicBrainz.choose}
            />
          )}

          <label className="flex flex-col gap-1.5">
            <span className={DETAILS_LABEL_STYLES}>Title</span>
            <input
              type="text"
              aria-label="Title"
              value={metadata.title}
              placeholder="Song title"
              onChange={(e) => setMetadata({ title: e.target.value })}
              className={DETAILS_FIELD_STYLES}
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
            className="font-mono font-medium tabular-nums"
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
            <span className={DETAILS_LABEL_STYLES}>Language</span>
            <input
              type="text"
              aria-label="Language"
              aria-describedby={languageHintId}
              aria-invalid={languageInvalid}
              value={languageValue}
              placeholder="e.g. en, ja, pt-BR"
              onChange={(e) => handleLanguageChange(e.target.value)}
              className={DETAILS_FIELD_STYLES}
            />
            {languageInvalid && (
              <span role="alert" className="text-xs text-composer-error-text select-text cursor-text">
                Invalid language ・ expected a BCP-47 tag like en or pt-BR
              </span>
            )}
            <span id={languageHintId} className="text-xs text-(--muted) select-none">
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
          onDismiss={thenFocusTitle(musicBrainz.dismiss)}
          onFill={thenFocusTitle(musicBrainz.fillAll)}
        />
      )}
    </aside>
  );
};

// -- Exports ------------------------------------------------------------------

export { MetadataPanel };

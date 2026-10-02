import { quotedTitle } from "@/domain/project/display-title";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { type AudioFilter, hasStoredYouTubeAudio, storedAudioProjects } from "@/domain/storage/stored-audio";
import { clearVocalStems, clearYouTubeAudio, removeAudioFromProject } from "@/lib/storage-actions";
import { useConfirm } from "@/stores/confirm-store";
import { Button } from "@/ui/button";
import { SegmentedControl } from "@/ui/segmented-control";
import { SettingRowLayout } from "@/ui/settings/setting-row-layout";
import { SettingText } from "@/ui/settings/setting-text";
import { ProjectAudioRow } from "@/ui/settings/storage/project-audio-row";
import { AUDIO_FILTER_OPTIONS } from "@/ui/settings/storage/storage-options";
import { formatProjectCount } from "@/utils/project-count";
import { IconBrandYoutube, IconMicrophone2 } from "@tabler/icons-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

// -- Types --------------------------------------------------------------------

interface ProjectAudioListProps {
  entries: readonly ProjectIndexEntry[];
  openProjectId: string | undefined;
  now: number;
  canClearYouTube: boolean;
  canClearStems: boolean;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[ProjectAudioList]";

// -- Helpers ------------------------------------------------------------------

function reportFailure(action: string, message: string): (error: unknown) => void {
  return (error) => {
    console.error(LOG_PREFIX, action, error);
    toast.error(message);
  };
}

function clearYouTube(): void {
  clearYouTubeAudio().then(
    (removal) => {
      if (removal.projects > 0) toast(`Cleared YouTube audio from ${formatProjectCount(removal.projects)}`);
    },
    reportFailure("could not clear the YouTube audio", "Couldn't clear the YouTube audio"),
  );
}

function clearStems(): void {
  clearVocalStems().then(
    (removal) => {
      if (removal.jobs > 0) toast("Cleared vocal stems");
    },
    reportFailure("could not clear the vocal stems", "Couldn't clear the vocal stems"),
  );
}

// -- Component ----------------------------------------------------------------

const ProjectAudioList: React.FC<ProjectAudioListProps> = ({
  entries,
  openProjectId,
  now,
  canClearYouTube,
  canClearStems,
}) => {
  const [filter, setFilter] = useState<AudioFilter>("all");
  const confirm = useConfirm();
  const showYouTube = hasStoredYouTubeAudio(entries);
  const [wasYouTubeStored, setWasYouTubeStored] = useState(showYouTube);
  if (showYouTube !== wasYouTubeStored) {
    setWasYouTubeStored(showYouTube);
    if (!showYouTube) setFilter("all");
  }
  const activeFilter = showYouTube ? filter : "all";
  const rows = useMemo(() => storedAudioProjects(entries, activeFilter), [entries, activeFilter]);

  const removeAudio = useCallback(
    async (entry: ProjectIndexEntry) => {
      if (entry.audioKind !== "youtube") {
        const confirmed = await confirm({
          title: `Remove audio from ${quotedTitle(entry.title)}?`,
          description: "The lyrics and timings stay. You'll need the original file to add it back.",
          confirmLabel: "Remove audio",
          variant: "destructive",
        });
        if (!confirmed) return;
      }
      await removeAudioFromProject(entry.id).catch(
        reportFailure("could not remove the audio", "Couldn't remove the audio"),
      );
    },
    [confirm],
  );

  return (
    <div className="flex flex-col gap-3">
      <SettingRowLayout className="py-0">
        <SettingText id="projectAudioList" />
        {showYouTube && (
          <SegmentedControl
            aria-label="Filter audio"
            value={activeFilter}
            options={AUDIO_FILTER_OPTIONS}
            onChange={setFilter}
          />
        )}
      </SettingRowLayout>
      {rows.length > 0 ? (
        <ul className="-mx-2 m-0 list-none p-0">
          {rows.map((entry) => (
            <ProjectAudioRow
              key={entry.id}
              entry={entry}
              isOpen={entry.id === openProjectId}
              now={now}
              onRemove={removeAudio}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg bg-composer-input px-3 py-2.5 text-xs text-composer-text-muted select-none">
          No audio is stored on this device.
        </p>
      )}
      {(canClearYouTube || canClearStems) && (
        <div className="flex flex-wrap gap-2">
          {canClearYouTube && (
            <Button variant="secondary" size="sm" hasIcon onClick={clearYouTube}>
              <IconBrandYoutube aria-hidden="true" className="size-3.5" />
              Clear YouTube audio
            </Button>
          )}
          {canClearStems && (
            <Button variant="secondary" size="sm" hasIcon onClick={clearStems}>
              <IconMicrophone2 aria-hidden="true" className="size-3.5" />
              Clear vocal stems
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ProjectAudioList };

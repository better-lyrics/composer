import { hasClearableYouTubeAudio } from "@/domain/storage/stored-audio";
import { hasClearableStems } from "@/domain/storage/usage";
import { useOpenProjectId } from "@/hooks/useOpenProjectId";
import { useProjectIndex } from "@/hooks/useProjectIndex";
import { useStorageReport } from "@/hooks/useStorageReport";
import { isProjectInUse } from "@/lib/open-project-session";
import { isStemJobInUse, useSeparationStore } from "@/stores/separation";
import { ProjectAudioList } from "@/ui/settings/storage/project-audio-list";

// -- Component ----------------------------------------------------------------

const ProjectAudioListSetting: React.FC = () => {
  const { entries, fetchedAt } = useProjectIndex();
  const openProjectId = useOpenProjectId();
  const report = useStorageReport();
  useSeparationStore((state) => state.jobKey);

  if (entries === undefined || report === undefined) return null;

  return (
    <div className="py-3">
      <ProjectAudioList
        entries={entries}
        openProjectId={openProjectId}
        now={fetchedAt}
        canClearYouTube={hasClearableYouTubeAudio(entries, isProjectInUse)}
        canClearStems={hasClearableStems(report.stemJobs, isStemJobInUse)}
      />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ProjectAudioListSetting };

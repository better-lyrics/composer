import { useProjectIndex } from "@/hooks/useProjectIndex";
import { BackUpAllProjectsRow, DeleteAllProjectsRow } from "@/ui/settings/storage/backup-settings";

// -- Components ---------------------------------------------------------------

const BackUpAllProjectsSetting: React.FC = () => {
  const { entries } = useProjectIndex();
  if (entries === undefined) return null;
  return <BackUpAllProjectsRow projectCount={entries.length} />;
};

const DeleteAllProjectsSetting: React.FC = () => {
  const { entries } = useProjectIndex();
  if (entries === undefined) return null;
  return <DeleteAllProjectsRow projectCount={entries.length} />;
};

// -- Exports ------------------------------------------------------------------

export { BackUpAllProjectsSetting, DeleteAllProjectsSetting };

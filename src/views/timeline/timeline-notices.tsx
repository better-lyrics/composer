import { useOpenProjectId } from "@/hooks/useOpenProjectId";
import { HeaderNotices } from "@/ui/notices/header-notices";
import { useGroupingNotice } from "@/views/grouping/use-grouping-notice";
import { useExplicitNotice } from "@/views/timeline/use-explicit-notice";
import { useSharedTimingNotice } from "@/views/timeline/use-shared-timing-notice";

// -- Components ---------------------------------------------------------------

const TimelineNotices: React.FC = () => {
  const grouping = useGroupingNotice();
  const sharing = useSharedTimingNotice();
  const explicit = useExplicitNotice();
  const projectId = useOpenProjectId();
  return <HeaderNotices key={projectId} kinds={[grouping, sharing, explicit]} />;
};

// -- Exports ------------------------------------------------------------------

export { TimelineNotices };

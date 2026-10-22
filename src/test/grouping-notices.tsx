import { HeaderNotices } from "@/ui/notices/header-notices";
import { useGroupingNotice } from "@/views/grouping/use-grouping-notice";

// -- Components ---------------------------------------------------------------

const GroupingNotices: React.FC = () => <HeaderNotices kinds={[useGroupingNotice()]} />;

// -- Exports ------------------------------------------------------------------

export { GroupingNotices };

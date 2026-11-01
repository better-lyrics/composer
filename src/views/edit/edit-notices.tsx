import { useOpenProjectId } from "@/hooks/useOpenProjectId";
import { HeaderNotices } from "@/ui/notices/header-notices";
import type { ParsedLine } from "@/views/edit/parse-lyrics";
import { useBracketNotice } from "@/views/edit/use-bracket-notice";
import { useGroupingNotice } from "@/views/grouping/use-grouping-notice";

// -- Components ---------------------------------------------------------------

// Grouping waits while the lyrics are typed; the bracket warning follows every keystroke.
const EditNotices: React.FC<{ parsed: readonly ParsedLine[]; isTyping: boolean }> = ({ parsed, isTyping }) => {
  const brackets = useBracketNotice(parsed);
  const grouping = useGroupingNotice(!isTyping);
  const projectId = useOpenProjectId();
  return <HeaderNotices key={projectId} kinds={[brackets, grouping]} noun="notices" />;
};

// -- Exports ------------------------------------------------------------------

export { EditNotices };

import type { ProjectTab } from "@/domain/project/tab";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";

// -- Interfaces ----------------------------------------------------------------

interface GoToTabButtonProps {
  tab: ProjectTab;
  children: React.ReactNode;
}

// -- Components ----------------------------------------------------------------

const GoToTabButton: React.FC<GoToTabButtonProps> = ({ tab, children }) => (
  <Button variant="primary" onClick={() => useProjectStore.getState().setActiveTab(tab)}>
    {children}
  </Button>
);

// -- Exports -------------------------------------------------------------------

export { GoToTabButton };

import { useUnisonSession } from "@/hooks/useUnisonSession";
import { useProjectStore } from "@/stores/project";
import { OnUnisonCard } from "@/views/export/unison/on-unison-card";
import { SignedOutCard } from "@/views/export/unison/signed-out-card";

// -- Components ----------------------------------------------------------------

const PanelCards: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col gap-4 p-4 shadow-[inset_0_-1px_0_var(--divider)] select-none">{children}</div>
);

const UnisonPanel: React.FC = () => {
  const session = useUnisonSession();
  const unisonLyricId = useProjectStore((state) => state.unisonLyricId);
  if (!session) {
    return (
      <PanelCards>
        <SignedOutCard />
      </PanelCards>
    );
  }
  if (!unisonLyricId) return null;
  return (
    <PanelCards>
      <OnUnisonCard key={unisonLyricId} lyricId={unisonLyricId} keyId={session.keyId} />
    </PanelCards>
  );
};

// -- Exports -------------------------------------------------------------------

export { UnisonPanel };

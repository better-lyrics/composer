import { useLinkedLyric } from "@/hooks/unison/useLinkedLyric";
import { isOtherAccountLyric } from "@/domain/unison/ownership";
import { useUnisonSession } from "@/hooks/useUnisonSession";
import type { StoredUnisonSession } from "@/lib/unison/session";
import { useProjectStore } from "@/stores/project";
import { OnUnisonCard } from "@/views/export/unison/on-unison-card";
import { SignedOutCard } from "@/views/export/unison/signed-out-card";
import { SubmitCard } from "@/views/export/unison/submit-card";
import { NewSubmission } from "@/views/export/unison/submit-videos";
import type { UnisonExportSource } from "@/views/export/unison/submit-card-shell";
import { VideosRow } from "@/views/export/unison/videos-row";
import { useState } from "react";

// -- Interfaces ----------------------------------------------------------------

interface UnisonPanelProps {
  source: UnisonExportSource;
}

interface SignedInCardsProps extends UnisonPanelProps {
  session: StoredUnisonSession;
  sessionEnded: boolean;
  onSessionEnded: () => void;
}

// -- Components ----------------------------------------------------------------

const PanelCards: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col gap-4 p-4 shadow-[inset_0_-1px_0_var(--divider)] select-none">{children}</div>
);

const LinkedCards: React.FC<SignedInCardsProps & { lyricId: string }> = ({ lyricId, ...props }) => {
  const linked = useLinkedLyric(lyricId);
  const owned = linked.kind === "found" && !isOtherAccountLyric(linked.lyric, props.session.keyId);
  return (
    <>
      <OnUnisonCard
        lyricId={lyricId}
        keyId={props.session.keyId}
        videos={
          linked.kind === "found" && (
            <VideosRow lyric={linked.lyric} durationSeconds={props.source.durationSeconds} canManage={owned} />
          )
        }
      />
      {linked.kind === "found" && owned && <SubmitCard key={lyricId} lyricId={linked.lyric.id} {...props} />}
    </>
  );
};

const UnisonPanel: React.FC<UnisonPanelProps> = ({ source }) => {
  const session = useUnisonSession();
  const unisonLyricId = useProjectStore((state) => state.unisonLyricId);
  // A 401 clears the stored session; keep the card up with a reconnect notice instead of the signed-out card.
  const [endedSession, setEndedSession] = useState<StoredUnisonSession | null>(null);
  if (session && endedSession) setEndedSession(null);

  const shownSession = session ?? endedSession;
  if (!shownSession) {
    return (
      <PanelCards>
        <SignedOutCard />
      </PanelCards>
    );
  }
  const cardProps: SignedInCardsProps = {
    source,
    session: shownSession,
    sessionEnded: session === null,
    onSessionEnded: () => setEndedSession(shownSession),
  };
  return (
    <PanelCards>
      {unisonLyricId ? (
        <LinkedCards key={unisonLyricId} lyricId={unisonLyricId} {...cardProps} />
      ) : (
        <NewSubmission {...cardProps} />
      )}
    </PanelCards>
  );
};

// -- Exports -------------------------------------------------------------------

export { UnisonPanel };

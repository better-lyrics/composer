import { isOwnLyric } from "@/domain/unison/ownership";
import { UNISON_VARIANT_CAP } from "@/domain/unison/submit-checks";
import { playsUnlinkedVideo } from "@/domain/unison/video-links";
import { useRevisionPreview } from "@/hooks/unison/useRevisionPreview";
import { useSubmitToUnison } from "@/hooks/unison/useSubmitToUnison";
import { useUnisonLyric } from "@/hooks/unison/useUnisonLyric";
import { useUnisonVariants } from "@/hooks/unison/useUnisonVariants";
import { useVideoLinks } from "@/hooks/unison/useVideoSuggestions";
import { isUnisonSessionEnded } from "@/lib/unison/client";
import { useProjectStore } from "@/stores/project";
import { cn } from "@/utils/cn";
import { pluralize } from "@/utils/pluralize";
import { ChangesSection } from "@/views/export/unison/changes-section";
import {
  CHECKS_FAILED_REASON,
  SubmitCardShell,
  type UnisonExportSource,
  useLyricsSubmission,
  useRevisionInput,
  useSubmitChecks,
} from "@/views/export/unison/submit-card-shell";
import { submitFailure } from "@/views/export/unison/submit-errors";
import { type SubmitIdentity, SubmitFooter } from "@/views/export/unison/submit-footer";
import { UNISON_CARD_TEXT_STYLES } from "@/views/export/unison/unison-card-styles";
import { YourVersions } from "@/views/export/unison/your-versions";
import { IconBolt, IconHourglassHigh, IconStack2 } from "@tabler/icons-react";
import { useCallback, useId, useMemo } from "react";

// -- Interfaces ----------------------------------------------------------------

interface SubmitterSession extends SubmitIdentity {
  keyId: string;
}

interface SubmitCardProps {
  lyricId: number | null;
  session: SubmitterSession;
  sessionEnded: boolean;
  onSessionEnded: () => void;
  source: UnisonExportSource;
  videoSection?: React.ReactNode;
  videoIds?: readonly string[];
}

type ModeCardProps = Omit<SubmitCardProps, "lyricId">;

// -- Hooks ---------------------------------------------------------------------

function useSender({ session, onSessionEnded, source }: ModeCardProps) {
  const onError = useCallback(
    (error: unknown) => {
      if (isUnisonSessionEnded(error)) onSessionEnded();
    },
    [onSessionEnded],
  );
  const sender = useSubmitToUnison(session.keyId, onError);
  const failed =
    sender.failure && sender.failure.lyrics === source.content ? submitFailure(sender.failure.error) : null;
  return { sender, onError, failureText: failed?.kind === "message" ? failed.text : null };
}

// -- Constants -----------------------------------------------------------------

const UNLINKED_VIDEO_REASON =
  "This project plays a video that is not linked to this lyric. Link it under Videos first.";

// -- Components ----------------------------------------------------------------

const Outcome: React.FC<{ icon: typeof IconBolt; warn?: boolean; children: React.ReactNode }> = ({
  icon: OutcomeIcon,
  warn,
  children,
}) => (
  <span className={cn("flex min-w-0 items-center gap-1.5", warn && "text-composer-warning")}>
    <OutcomeIcon aria-hidden="true" className="size-3.5 shrink-0" />
    <span className="truncate tabular-nums">{children}</span>
  </span>
);

const ChecksReason: React.FC<{ id: string }> = ({ id }) => (
  <span id={id} className="sr-only">
    {CHECKS_FAILED_REASON}
  </span>
);

const NewSubmissionCard: React.FC<ModeCardProps> = (props) => {
  const { session, sessionEnded, source, videoSection, videoIds = [] } = props;
  const checks = useSubmitChecks("new", source);
  const submission = useLyricsSubmission(source, checks);
  const variants = useUnisonVariants(source.videoId);
  const { sender, failureText } = useSender(props);
  const checksReasonId = useId();
  const versionsReasonId = useId();
  const mine = useMemo(
    () => variants.data?.filter((variant) => isOwnLyric(variant, session.keyId)) ?? [],
    [variants.data, session.keyId],
  );
  const capReached = mine.length >= UNISON_VARIANT_CAP;
  const outcome =
    mine.length === 0 && variants.data ? (
      <Outcome icon={IconStack2}>
        {variants.data.length === 0 ? "First version" : `New version ・ ${pluralize(variants.data.length, "other")}`}
      </Outcome>
    ) : null;

  return (
    <SubmitCardShell mode="new" busy={sender.pending} source={source} checks={checks}>
      {mine.length > 0 && (
        <YourVersions
          versions={mine}
          capReached={capReached}
          reasonId={versionsReasonId}
          onUpdate={(lyricId) => useProjectStore.getState().linkUnisonLyric(String(lyricId))}
        />
      )}
      {!capReached && videoSection}
      {!checks.canSubmit && <ChecksReason id={checksReasonId} />}
      <SubmitFooter
        identity={session}
        outcome={outcome}
        sessionEnded={sessionEnded}
        failure={failureText}
        label="Submit to Unison"
        pending={sender.pending}
        disabled={!submission || capReached}
        blockedReasonId={capReached ? versionsReasonId : checksReasonId}
        onSend={() => submission && void sender.send({ kind: "new", submission, videoIds })}
      />
    </SubmitCardShell>
  );
};

function useUpdateTarget(lyricId: number, sourceVideoId: string | undefined) {
  const lyric = useUnisonLyric(lyricId).data;
  const links = useVideoLinks(lyricId).data;
  return {
    replacesPending: Boolean(lyric?.revision.pending),
    unlinkedVideo: lyric !== undefined && playsUnlinkedVideo(sourceVideoId, lyric.videoId, links),
  };
}

const UpdateOutcome: React.FC<{ goesLive: boolean; replacesPending: boolean }> = ({ goesLive, replacesPending }) => (
  <Outcome icon={goesLive ? IconBolt : IconHourglassHigh} warn={!goesLive}>
    {goesLive ? "Goes live now" : "Council reviews it first"}
    {replacesPending && ", replaces pending edit"}
  </Outcome>
);

const UpdateCard: React.FC<ModeCardProps & { lyricId: number }> = (props) => {
  const { lyricId, session, sessionEnded, source } = props;
  const checks = useSubmitChecks("update", source);
  const input = useRevisionInput(source.content);
  const { sender, onError, failureText } = useSender(props);
  const { query, settling } = useRevisionPreview(lyricId, input, onError);
  const { replacesPending, unlinkedVideo } = useUpdateTarget(lyricId, source.videoId);
  const checksReasonId = useId();
  const changesReasonId = useId();
  const videoReasonId = useId();
  const preview = query.data;
  const goesLive = preview?.outcome.goesLive ?? true;
  const blockedReasonId = !checks.canSubmit ? checksReasonId : unlinkedVideo ? videoReasonId : changesReasonId;

  return (
    <SubmitCardShell mode="update" busy={sender.pending} source={source} checks={checks}>
      <ChangesSection
        preview={preview}
        error={query.error}
        reasonId={changesReasonId}
        onRetry={() => void query.refetch()}
      />
      {!checks.canSubmit && <ChecksReason id={checksReasonId} />}
      {unlinkedVideo && (
        <p id={videoReasonId} className={UNISON_CARD_TEXT_STYLES}>
          {UNLINKED_VIDEO_REASON}
        </p>
      )}
      <SubmitFooter
        identity={session}
        outcome={preview && <UpdateOutcome goesLive={goesLive} replacesPending={replacesPending} />}
        sessionEnded={sessionEnded}
        failure={failureText}
        label={goesLive ? "Send update" : "Send for review"}
        pending={sender.pending}
        disabled={!checks.canSubmit || unlinkedVideo || !preview || preview.noChanges || settling}
        blockedReasonId={blockedReasonId}
        onSend={() => void sender.send({ kind: "update", lyricId, input })}
      />
    </SubmitCardShell>
  );
};

const SubmitCard: React.FC<SubmitCardProps> = ({ lyricId, ...props }) =>
  lyricId === null ? <NewSubmissionCard {...props} /> : <UpdateCard lyricId={lyricId} {...props} />;

// -- Exports -------------------------------------------------------------------

export { SubmitCard };
export type { SubmitterSession };

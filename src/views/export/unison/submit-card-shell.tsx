import type { AlignmentReview } from "@/domain/alignment/review-state";
import { isProjectFullySynced } from "@/domain/line/sync-progress";
import { namedArtists } from "@/domain/project/display-title";
import { normalizeLanguageTag } from "@/domain/project/language";
import { type SubmitCheck, type SubmitChecks, type SubmitMode, submitChecks } from "@/domain/unison/submit-checks";
import type { LyricsSubmission } from "@/lib/unison/api-types";
import type { RevisionInput } from "@/lib/unison/revision-types";
import { useProjectStore } from "@/stores/project";
import { CheckList } from "@/views/export/unison/submit-checks";
import { PanelSection } from "@/views/export/unison/panel-section";
import { UNISON_CARD_HEADING_STYLES, UNISON_CARD_STYLES } from "@/views/export/unison/unison-card-styles";
import { useId, useMemo } from "react";

// -- Interfaces ----------------------------------------------------------------

interface UnisonExportSource {
  content: string;
  isEdited: boolean;
  videoId: string | undefined;
  durationSeconds: number;
  lineCount: number;
  syncedLineCount: number;
  review: AlignmentReview;
  reviewInTimeline: () => void;
  regenerate: () => void;
}

interface SubmitCardShellProps {
  mode: SubmitMode;
  busy: boolean;
  source: UnisonExportSource;
  checks: SubmitChecks;
  children: React.ReactNode;
}

type PassedVideoCheck = Extract<SubmitCheck, { id: "video"; status: "pass" }>;

// -- Constants -----------------------------------------------------------------

const CARD_TITLES: Record<SubmitMode, string> = { new: "Submit to Unison", update: "Update on Unison" };
const CHECKS_FAILED_REASON = "Fix the failed checks first.";

// -- Helpers -------------------------------------------------------------------

function optionalText(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

function passedVideo(checks: SubmitChecks): PassedVideoCheck | undefined {
  return checks.checks.find((check): check is PassedVideoCheck => check.id === "video" && check.status === "pass");
}

// -- Hooks ---------------------------------------------------------------------

function useSubmitChecks(mode: SubmitMode, source: UnisonExportSource): SubmitChecks {
  const metadata = useProjectStore((state) => state.metadata);
  const lines = useProjectStore((state) => state.lines);
  const fullySynced = useMemo(() => isProjectFullySynced(lines), [lines]);
  return useMemo(
    () =>
      submitChecks({
        mode,
        videoId: source.videoId,
        durationSeconds: source.durationSeconds || metadata.duration,
        title: metadata.title,
        artists: metadata.artists,
        syncedLineCount: source.syncedLineCount,
        lineCount: source.lineCount,
        fullySynced,
        alignmentTier: source.review.tier,
        content: source.content,
        contentIsEdited: source.isEdited,
        isrc: metadata.isrc,
      }),
    [mode, source, metadata, fullySynced],
  );
}

function useLyricsSubmission(source: UnisonExportSource, checks: SubmitChecks): LyricsSubmission | null {
  const metadata = useProjectStore((state) => state.metadata);
  return useMemo(() => {
    const video = passedVideo(checks);
    if (!video || !checks.canSubmit) return null;
    return {
      videoId: video.videoId,
      song: metadata.title.trim(),
      // Unison's credit matcher splits on commas, so each artist matches on its own.
      artist: namedArtists(metadata.artists).join(", "),
      album: optionalText(metadata.album),
      isrc: optionalText(metadata.isrc),
      duration: video.durationSeconds,
      lyrics: source.content,
      format: "ttml",
      language: normalizeLanguageTag(metadata.language ?? ""),
    };
  }, [checks, metadata, source.content]);
}

function useRevisionInput(content: string): RevisionInput {
  const metadata = useProjectStore((state) => state.metadata);
  return useMemo(
    () => ({
      lyrics: content,
      format: "ttml",
      // Empty project fields stay undefined so an update never clears what Unison already has.
      language: normalizeLanguageTag(metadata.language ?? ""),
      isrc: optionalText(metadata.isrc),
      album: optionalText(metadata.album),
    }),
    [content, metadata.language, metadata.isrc, metadata.album],
  );
}

// -- Components ----------------------------------------------------------------

const SubmitCardShell: React.FC<SubmitCardShellProps> = ({ mode, busy, source, checks, children }) => {
  const headingId = useId();
  const isrc = useProjectStore((state) => state.metadata.isrc);
  return (
    <section aria-labelledby={headingId} aria-busy={busy} className={UNISON_CARD_STYLES}>
      <h3 id={headingId} className={UNISON_CARD_HEADING_STYLES}>
        {CARD_TITLES[mode]}
      </h3>
      <div className="flex flex-col">
        <PanelSection first title="Checks">
          <CheckList
            checks={checks.checks}
            alignmentTier={source.review.tier}
            isrc={isrc}
            reviewInTimeline={source.reviewInTimeline}
            regenerate={source.regenerate}
          />
        </PanelSection>
        {children}
      </div>
    </section>
  );
};

// -- Exports -------------------------------------------------------------------

export { CHECKS_FAILED_REASON, SubmitCardShell, useLyricsSubmission, useRevisionInput, useSubmitChecks };
export type { UnisonExportSource };

import { resolveAlignmentModel } from "@/audio/alignment/hubertfa/model-manifest";
import type { SegmentAlignment } from "@/audio/alignment/types";
import {
  type AlignedLineRecord,
  buildTelemetryPayload,
  payloadDigest,
  type TelemetrySong,
  telemetryWords,
} from "@/domain/alignment/telemetry";
import type { AlignmentWindow } from "@/domain/alignment/window";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { settleAlignmentSharing, telemetryEndpoint } from "@/lib/alignment-telemetry-consent";
import { markTelemetrySent, readProjectTelemetry, recordAlignedLines } from "@/lib/alignment-telemetry-storage";
import { bindSaveTarget, openProjectIdSnapshot } from "@/lib/open-project-session";
import { useAlignmentTelemetryStore } from "@/stores/alignment-telemetry";
import { useProjectStore } from "@/stores/project";

// Collecting what auto-align gave each line while sharing is on, and sending
// it with the exported timing when the user exports. Nothing leaves the device
// before an export, and no failure here ever reaches the user.

// -- Types --------------------------------------------------------------------

interface AlignedRunLine {
  line: LyricLine;
  taps: { begin: number; end: number };
  window: AlignmentWindow;
  result: SegmentAlignment;
  timings: WordTiming[];
}

interface AlignedRun {
  modelId: string;
  language: string | null;
  realign: boolean;
  lines: readonly AlignedRunLine[];
}

interface ExportedSong {
  ttml: string;
  song: TelemetrySong;
  lines: readonly LyricLine[];
}

interface Export {
  ttml: string;
  youtubeVideoId: string | undefined;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[alignment-telemetry]";

// -- Functions ----------------------------------------------------------------

function modelFile(url: string | undefined): string | null {
  const name = url?.split("/").pop();
  return name ? name : null;
}

async function collect(run: AlignedRun): Promise<void> {
  // Bound first, so switching projects while the model resolves can't file these lines under the next one.
  const projectId = await bindSaveTarget();
  const model = await resolveAlignmentModel(run.modelId);
  const alignedAt = Date.now();
  const records = run.lines.map(
    ({ line, taps, window, result, timings }): AlignedLineRecord => ({
      lineId: line.id,
      text: line.text,
      model: { id: model?.id ?? run.modelId, file: modelFile(model?.modelUrl) },
      language: run.language,
      taps: { begin: taps.begin, end: taps.end },
      window: { begin: window.begin, end: window.end },
      leadIn: result.anchor ? "anchored" : "searched",
      track: "main",
      realign: run.realign,
      fellBack: result.fellBack,
      guessedWords: result.guessedWords,
      alignedAt,
      aligned: telemetryWords(timings),
    }),
  );
  if (!useAlignmentTelemetryStore.getState().enabled) return;
  await recordAlignedLines(projectId, records);
  // Sharing may have been switched off while this was written.
  await settleAlignmentSharing();
}

/** Keeps the lines a run applied, on this device, while sharing is on. */
function collectAlignedRun(run: AlignedRun): void {
  if (!useAlignmentTelemetryStore.getState().enabled || run.lines.length === 0) return;
  collect(run).catch((error: unknown) => console.warn(LOG_PREFIX, "couldn't keep the aligned lines", error));
}

async function send(exported: ExportedSong, endpoint: string): Promise<void> {
  const projectId = openProjectIdSnapshot();
  const record = projectId ? await readProjectTelemetry(projectId) : undefined;
  if (!projectId || !record) return;
  const { installId } = useAlignmentTelemetryStore.getState();
  const payload = await buildTelemetryPayload({
    installId,
    app: { version: __APP_VERSION__, commit: __APP_COMMIT__ },
    song: exported.song,
    record,
    lines: exported.lines,
    ttml: exported.ttml,
  });
  if (!payload) return;
  const digest = await payloadDigest(payload);
  if (digest === record.lastSent || !useAlignmentTelemetryStore.getState().enabled) return;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`telemetry endpoint answered ${response.status}`);
  const now = useAlignmentTelemetryStore.getState();
  if (now.installId !== installId) {
    // Switched off while this was in flight: what just arrived is deleted too.
    useAlignmentTelemetryStore.setState({ pendingDeletes: [...now.pendingDeletes, installId] });
    await settleAlignmentSharing();
    return;
  }
  useAlignmentTelemetryStore.setState({ sentUnderId: true });
  await markTelemetrySent(projectId, digest);
}

/** Sends the open project's collected lines with the timing just exported. Never throws, never waits the caller. */
function sendAlignmentTelemetry({ ttml, youtubeVideoId }: Export): void {
  const endpoint = telemetryEndpoint();
  if (!endpoint || !useAlignmentTelemetryStore.getState().enabled) return;
  const { metadata, lines } = useProjectStore.getState();
  const song: TelemetrySong = {
    title: metadata.title,
    artists: metadata.artists,
    videoId: youtubeVideoId ?? null,
    language: metadata.language ?? null,
  };
  send({ ttml, song, lines }, endpoint).catch((error: unknown) => console.warn(LOG_PREFIX, "couldn't send", error));
}

// -- Exports ------------------------------------------------------------------

export { collectAlignedRun, sendAlignmentTelemetry };
export type { AlignedRunLine };

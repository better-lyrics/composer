import type { LagResult, PerChunkLag } from "@/pages/diagnostics/separation-diagnostics";
import { Button } from "@/ui/button";
import { IconDownload } from "@tabler/icons-react";

// -- Constants ----------------------------------------------------------------

const PLOT_DURATION_SEC = 3;
const PLOT_WIDTH = 800;
const PLOT_HEIGHT = 200;

// -- Types --------------------------------------------------------------------

interface Diagnostics {
  vocalsLag: LagResult | null;
  instrumentalLag: LagResult | null;
  perChunkLag: PerChunkLag[];
}

interface ResultsProps {
  diagnostics: Diagnostics;
  sampleRate: number;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onDownloadVocals: () => void;
  onDownloadInstrumental: () => void;
}

// -- Helpers ------------------------------------------------------------------

function formatLag(lag: LagResult | null): string {
  if (!lag) return "n/a (insufficient signal)";
  const sign = lag.lagSamples >= 0 ? "+" : "";
  return `${sign}${lag.lagSamples} samples (${sign}${lag.lagMs.toFixed(2)} ms), peak r=${lag.peakCorrelation.toFixed(3)}`;
}

function describeOverall(label: string, lag: LagResult | null): string {
  if (!lag) return `${label}: n/a`;
  const direction = lag.lagSamples > 0 ? "leads original" : lag.lagSamples < 0 ? "trails original" : "aligned";
  return `${label}: ${direction} by ${Math.abs(lag.lagSamples)} samples (${Math.abs(lag.lagMs).toFixed(2)} ms)`;
}

// -- Components ---------------------------------------------------------------

const OverallLagSection: React.FC<{ diagnostics: Diagnostics }> = ({ diagnostics }) => (
  <section className="rounded-md border border-composer-border bg-composer-button p-4 flex flex-col gap-2">
    <h2 className="text-sm font-medium">Overall cross-correlation lag</h2>
    <p className="text-xs text-composer-text-muted">
      Positive lag means the target leads the original. Negative means it trails.
    </p>
    <dl className="grid grid-cols-1 gap-2 text-xs font-mono">
      <div className="flex flex-col gap-0.5">
        <dt className="text-composer-text-muted">Vocals vs Original</dt>
        <dd className="select-text cursor-text">{formatLag(diagnostics.vocalsLag)}</dd>
        <dd className="select-text cursor-text text-composer-text-muted">
          {describeOverall("Vocals", diagnostics.vocalsLag)}
        </dd>
      </div>
      <div className="flex flex-col gap-0.5">
        <dt className="text-composer-text-muted">Instrumental vs Original</dt>
        <dd className="select-text cursor-text">{formatLag(diagnostics.instrumentalLag)}</dd>
        <dd className="select-text cursor-text text-composer-text-muted">
          {describeOverall("Instrumental", diagnostics.instrumentalLag)}
        </dd>
      </div>
    </dl>
  </section>
);

const PerChunkSection: React.FC<{ rows: PerChunkLag[] }> = ({ rows }) => (
  <section className="rounded-md border border-composer-border bg-composer-button p-4 flex flex-col gap-2">
    <h2 className="text-sm font-medium">Per-chunk lag</h2>
    <p className="text-xs text-composer-text-muted">
      Constant lag points at the model. Accumulating lag points at the stitcher. Boundary-only points at overlap-add.
    </p>
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead className="text-composer-text-muted">
          <tr>
            <th className="text-left py-1 pr-3">Chunk</th>
            <th className="text-left py-1 pr-3">Start</th>
            <th className="text-left py-1 pr-3">End</th>
            <th className="text-left py-1 pr-3">Lag (samples)</th>
            <th className="text-left py-1 pr-3">Lag (ms)</th>
            <th className="text-left py-1 pr-3">Peak r</th>
          </tr>
        </thead>
        <tbody className="select-text cursor-text">
          {rows.map((row) => (
            <tr key={row.chunkIndex} className="border-t border-composer-border">
              <td className="py-1 pr-3">{row.chunkIndex}</td>
              <td className="py-1 pr-3">{row.start}</td>
              <td className="py-1 pr-3">{row.end}</td>
              <td className="py-1 pr-3">{row.lag ? row.lag.lagSamples : "n/a"}</td>
              <td className="py-1 pr-3">{row.lag ? row.lag.lagMs.toFixed(2) : "n/a"}</td>
              <td className="py-1 pr-3">{row.lag ? row.lag.peakCorrelation.toFixed(3) : "n/a"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

const WaveformSection: React.FC<{ canvasRef: React.RefObject<HTMLCanvasElement | null> }> = ({ canvasRef }) => (
  <section className="rounded-md border border-composer-border bg-composer-button p-4 flex flex-col gap-2">
    <h2 className="text-sm font-medium">Waveform overlay (first {PLOT_DURATION_SEC} s)</h2>
    <p className="text-xs text-composer-text-muted">
      Grey: original. Blue: vocals. Orange: instrumental. Misalignment reads as visible offset between traces.
    </p>
    <canvas
      ref={canvasRef}
      width={PLOT_WIDTH}
      height={PLOT_HEIGHT}
      className="w-full max-w-full rounded-sm border border-composer-border bg-black"
      aria-label="Overlaid waveforms"
    />
  </section>
);

const DownloadSection: React.FC<{ sampleRate: number; onVocals: () => void; onInstrumental: () => void }> = ({
  sampleRate,
  onVocals,
  onInstrumental,
}) => (
  <section className="rounded-md border border-composer-border bg-composer-button p-4 flex flex-col gap-2">
    <h2 className="text-sm font-medium">Download stems</h2>
    <p className="text-xs text-composer-text-muted">
      For external cross-checks. WAV @ {sampleRate} Hz, 16-bit, stereo.
    </p>
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" hasIcon onClick={onVocals}>
        <IconDownload size={16} />
        Vocals WAV
      </Button>
      <Button variant="secondary" hasIcon onClick={onInstrumental}>
        <IconDownload size={16} />
        Instrumental WAV
      </Button>
    </div>
  </section>
);

const DiagnosticsResults: React.FC<ResultsProps> = ({
  diagnostics,
  sampleRate,
  canvasRef,
  onDownloadVocals,
  onDownloadInstrumental,
}) => (
  <div className="flex flex-col gap-4">
    <OverallLagSection diagnostics={diagnostics} />
    <PerChunkSection rows={diagnostics.perChunkLag} />
    <WaveformSection canvasRef={canvasRef} />
    <DownloadSection sampleRate={sampleRate} onVocals={onDownloadVocals} onInstrumental={onDownloadInstrumental} />
  </div>
);

// -- Exports ------------------------------------------------------------------

export { DiagnosticsResults, PLOT_DURATION_SEC, PLOT_HEIGHT, PLOT_WIDTH };
export type { Diagnostics };

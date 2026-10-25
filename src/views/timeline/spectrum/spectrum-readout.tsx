import { CHUNK_FRAMES } from "@/domain/spectrum/chunk-order";
import { frequencyAtRow } from "@/domain/spectrum/frequency-scale";
import { decodeDb } from "@/domain/spectrum/levels";
import { noteOfFrequency } from "@/domain/spectrum/note";
import { useSettingsStore } from "@/stores/settings";
import { currentOverviewBandHeight } from "@/views/timeline/overview-band-height";
import { type SpectrumSessionState, spectrumSession } from "@/views/timeline/spectrum/spectrum-session";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useEffect, useRef } from "react";

// -- Constants -----------------------------------------------------------------

const BAND_BORDER = 1;
const POINTER_GAP = 12;
const FLIP_ROOM = 220;
const READOUT_HEIGHT = 20;
const EDGE_INSET = 3;

// -- Helpers -------------------------------------------------------------------

function formatFrequency(hz: number): string {
  if (hz < 1000) return `${Math.round(hz)} Hz`;
  return `${(hz / 1000).toFixed(hz < 10000 ? 2 : 1)} kHz`;
}

function formatCents(cents: number): string {
  if (cents === 0) return "";
  return ` ${cents > 0 ? "+" : "−"}${Math.abs(cents)}¢`;
}

// Frame f is centred at f * hop / sampleRate, so the nearest frame is a rounding.
function levelAt(session: SpectrumSessionState, seconds: number, hz: number): number | null {
  const { magnitude, chunkReady, frames, bins } = session;
  if (!magnitude || !chunkReady) return null;
  const frame = Math.round((seconds * session.sampleRate) / session.hop);
  if (frame < 0 || frame >= frames || chunkReady[Math.floor(frame / CHUNK_FRAMES)] !== 1) return null;
  const bin = Math.min(bins - 1, Math.round(hz / (session.sampleRate / session.fftSize)));
  return Math.round(decodeDb(magnitude[frame * bins + bin]));
}

// -- Components ----------------------------------------------------------------

const SpectrumReadout: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const hzRef = useRef<HTMLSpanElement>(null);
  const noteRef = useRef<HTMLSpanElement>(null);
  const centsRef = useRef<HTMLSpanElement>(null);
  const dbRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const viewport = root?.parentElement;
    const band = root?.closest<HTMLElement>("[data-overview-band]");
    const container = root?.closest<HTMLElement>("[data-scroll-container]");
    const line = lineRef.current;
    const readout = readoutRef.current;
    if (!viewport || !band || !container || !line || !readout) return;

    const hide = () => {
      line.hidden = true;
      readout.hidden = true;
    };
    const handlePointerMove = (e: PointerEvent) => {
      const box = viewport.getBoundingClientRect();
      const height = currentOverviewBandHeight() - BAND_BORDER;
      const { zoom } = useTimelineStore.getState();
      const { spectrumScale, spectrumTop } = useSettingsStore.getState();
      const x = e.clientX - box.left;
      const y = Math.min(height - 1, Math.max(0, e.clientY - box.top));
      const hz = frequencyAtRow(spectrumScale, spectrumTop, y, height);
      const db = zoom > 0 ? levelAt(spectrumSession, (x + container.scrollLeft) / zoom, hz) : null;
      const note = noteOfFrequency(hz);
      if (db === null || !note || !hzRef.current || !noteRef.current || !centsRef.current || !dbRef.current) {
        hide();
        return;
      }
      hzRef.current.textContent = formatFrequency(hz);
      noteRef.current.textContent = note.name;
      centsRef.current.textContent = formatCents(note.cents);
      dbRef.current.textContent = `${db} dB`;
      readout.hidden = false;
      line.hidden = false;
      const flip = x > box.width - FLIP_ROOM;
      const left = flip ? x - POINTER_GAP - readout.offsetWidth : x + POINTER_GAP;
      const top = Math.min(height - READOUT_HEIGHT - EDGE_INSET, Math.max(EDGE_INSET, y - READOUT_HEIGHT / 2));
      readout.style.transform = `translate(${left}px, ${top}px)`;
      line.style.top = `${Math.round(y)}px`;
    };

    band.addEventListener("pointermove", handlePointerMove);
    band.addEventListener("pointerleave", hide);
    return () => {
      band.removeEventListener("pointermove", handlePointerMove);
      band.removeEventListener("pointerleave", hide);
      hide();
    };
  }, []);

  return (
    <div ref={rootRef} className="contents">
      <div
        ref={lineRef}
        hidden
        className="absolute inset-x-0 h-0 border-t border-white/60 shadow-[0_1px_0_rgb(0_0_0/0.35)] [[data-overview-resizing]_&]:hidden"
      />
      <div
        ref={readoutRef}
        hidden
        className="absolute top-0 left-0 flex h-5 items-center [[data-overview-resizing]_&]:hidden gap-1.5 whitespace-nowrap rounded-md bg-(--pop) px-2 font-mono text-[11px] font-medium tabular-nums text-(--ink) shadow-[inset_0_0_0_1px_var(--edge),0_6px_16px_-6px_rgb(var(--shade)/0.5)] select-text"
      >
        <span ref={hzRef} />
        <span className="font-sans font-semibold text-composer-accent-text">
          <span ref={noteRef} />
          <span ref={centsRef} className="text-(--muted)" />
        </span>
        <span ref={dbRef} className="text-(--muted)" />
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { SpectrumReadout };

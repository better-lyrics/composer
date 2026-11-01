import { useLevelEnvelope } from "@/audio/deck/use-level-envelope";
import { levelAt } from "@/audio/level-envelope";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { animateFrames } from "@/lib/frame-loop";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";

// -- Types --------------------------------------------------------------------

type SegmentState = "" | "on" | "hot" | "clip" | "peak";

interface ChannelMeter {
  level: number;
  peak: number;
  hold: number;
  needle: number;
  lit: number;
  peakSegment: number;
}

// -- Constants ----------------------------------------------------------------

const NEEDLE_REST = -40;
const NEEDLE_SWING = 84;
const NEEDLE_FLOOR_DB = -30;
const PEAK_HOLD_SECONDS = 0.8;
const LEVEL_RELEASE_PER_SECOND = 1.6;
const PEAK_RELEASE_PER_SECOND = 0.6;
const NEEDLE_ATTACK = 0.35;
const NEEDLE_RELEASE = 0.12;
const DECIBEL_REFRESH_MS = 100;
const SILENCE = 0.001;

// The scale reads -24, -12, -6 and 0 at its quarter marks: each quarter of the strip spans one of these ranges.
const QUARTER_RANGES_DB: readonly [number, number][] = [
  [-36, -24],
  [-24, -12],
  [-12, -6],
  [-6, 0],
];

// -- Helpers ------------------------------------------------------------------

function segmentFloorDb(segment: number, segments: number): number {
  const perQuarter = segments / QUARTER_RANGES_DB.length;
  const [low, high] = QUARTER_RANGES_DB[Math.floor(segment / perQuarter)];
  return low + ((high - low) * (segment % perQuarter)) / perQuarter;
}

function toDecibels(level: number): number {
  return level > 0 ? 20 * Math.log10(level) : Number.NEGATIVE_INFINITY;
}

function litSegments(level: number, floors: readonly number[]): number {
  const decibels = toDecibels(level);
  let lit = 0;
  while (lit < floors.length && decibels >= floors[lit]) lit++;
  return lit;
}

function segmentState(segment: number, lit: number, peakSegment: number, segments: number): SegmentState {
  if (segment < lit) {
    if (segment >= segments - 2) return "clip";
    if (segment >= segments - 5) return "hot";
    return "on";
  }
  return segment === peakSegment && peakSegment > 0 ? "peak" : "";
}

// Frame-rate independent version of "move this fraction of the way per 60 Hz frame".
function easeToward(current: number, target: number, perFrame: number, seconds: number): number {
  return current + (target - current) * (1 - (1 - perFrame) ** (seconds * 60));
}

function stepChannel(meter: ChannelMeter, target: number, loudness: number, seconds: number): void {
  meter.level = target > meter.level ? target : Math.max(target, meter.level - seconds * LEVEL_RELEASE_PER_SECOND);
  if (meter.level >= meter.peak) {
    meter.peak = meter.level;
    meter.hold = PEAK_HOLD_SECONDS;
  } else {
    meter.hold -= seconds;
    if (meter.hold < 0) meter.peak = Math.max(meter.level, meter.peak - seconds * PEAK_RELEASE_PER_SECOND);
  }
  const loudnessDb = toDecibels(loudness);
  const swing = Math.min(1, Math.max(0, (loudnessDb - NEEDLE_FLOOR_DB) / -NEEDLE_FLOOR_DB));
  const needleTarget = NEEDLE_REST + swing * NEEDLE_SWING;
  const speed = needleTarget > meter.needle ? NEEDLE_ATTACK : NEEDLE_RELEASE;
  meter.needle = easeToward(meter.needle, needleTarget, speed, seconds);
}

function isAtRest(meters: readonly ChannelMeter[]): boolean {
  return meters.every((meter) => meter.peak < SILENCE && meter.needle - NEEDLE_REST < 0.05);
}

function freshMeter(): ChannelMeter {
  return { level: 0, peak: 0, hold: 0, needle: NEEDLE_REST, lit: -1, peakSegment: -1 };
}

// -- Hook ---------------------------------------------------------------------

function useMeterBallistics(segments: number) {
  const envelope = useLevelEnvelope();
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const leftNeedleRef = useRef<HTMLDivElement>(null);
  const rightNeedleRef = useRef<HTMLDivElement>(null);
  const needleRefs = [leftNeedleRef, rightNeedleRef];
  const segmentRefs = useRef<(HTMLElement | null)[][]>([[], []]);
  const decibelRef = useRef<HTMLElement>(null);
  const floors = useMemo(
    () => Array.from({ length: segments }, (_, segment) => segmentFloorDb(segment, segments)),
    [segments],
  );
  const meters = useRef([freshMeter(), freshMeter()]).current;
  const clock = useRef({ last: 0, decibelAt: 0, decibelText: "" }).current;
  const releaseRef = useRef<(() => void) | null>(null);

  // The readout has no React children: the frame loop owns its text from the first frame on.
  useLayoutEffect(() => {
    if (decibelRef.current && !decibelRef.current.textContent) decibelRef.current.textContent = "-inf";
  }, []);

  // Playback holds the frame loop awake; after a pause the meters still need frames to fall back to rest.
  useEffect(() => {
    if (isPlaying) return;
    releaseRef.current = animateFrames("deck-meters-decay");
    return () => {
      releaseRef.current?.();
      releaseRef.current = null;
    };
  }, [isPlaying]);

  useFrameLoop((now) => {
    const seconds = clock.last === 0 ? 0 : Math.min(0.1, (now - clock.last) / 1000);
    clock.last = now;
    const { isPlaying: playing, volume, isMuted } = useAudioStore.getState();
    const gain = playing && envelope && !isMuted ? volume : 0;
    const time = livePlaybackTime();

    meters.forEach((meter, channel) => {
      const target = envelope ? levelAt(envelope.peaks[channel], envelope.windowsPerSecond, time) * gain : 0;
      const loudness = envelope ? levelAt(envelope.rms[channel], envelope.windowsPerSecond, time) * gain : 0;
      stepChannel(meter, target, loudness, seconds);

      const needle = needleRefs[channel].current;
      if (needle) needle.style.rotate = `${meter.needle}deg`;

      const lit = litSegments(meter.level, floors);
      const peakSegment = Math.min(segments - 1, litSegments(meter.peak, floors) - 1);
      if (lit === meter.lit && peakSegment === meter.peakSegment) return;
      meter.lit = lit;
      meter.peakSegment = peakSegment;
      segmentRefs.current[channel].forEach((element, segment) => {
        if (!element) return;
        const state = segmentState(segment, lit, peakSegment, segments);
        if (element.dataset.state !== state) element.dataset.state = state;
      });
    });

    if (now - clock.decibelAt >= DECIBEL_REFRESH_MS && decibelRef.current) {
      clock.decibelAt = now;
      const level = Math.max(meters[0].level, meters[1].level);
      const text = level > SILENCE ? toDecibels(level).toFixed(1) : "-inf";
      if (text !== clock.decibelText) {
        clock.decibelText = text;
        decibelRef.current.textContent = text;
      }
    }

    if (!playing && isAtRest(meters)) {
      releaseRef.current?.();
      releaseRef.current = null;
    }
  }, "deck-meters");

  return { needleRefs, segmentRefs, decibelRef };
}

// -- Exports ------------------------------------------------------------------

export { useMeterBallistics };

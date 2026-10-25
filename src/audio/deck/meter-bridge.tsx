import { useMeterBallistics } from "@/audio/deck/use-meter-ballistics";

// -- Constants ----------------------------------------------------------------

const SEGMENTS = 16;
const CHANNELS = ["L", "R"] as const;
const SCALE_LABELS = ["-24", "-12", "-6", "0"];

const VU_CENTER = 48;
const VU_RADIUS = 38;
const VU_TICKS = Array.from({ length: 13 }, (_, step) => {
  const angle = (-44 + step * (88 / 12)) * (Math.PI / 180);
  const major = step % 3 === 0;
  const inner = major ? VU_RADIUS - 9 : VU_RADIUS - 5;
  return {
    x1: VU_CENTER + Math.sin(angle) * inner,
    y1: VU_CENTER - Math.cos(angle) * inner,
    x2: VU_CENTER + Math.sin(angle) * VU_RADIUS,
    y2: VU_CENTER - Math.cos(angle) * VU_RADIUS,
    major,
    hot: step >= 9,
  };
});

const VU_HOT_ARC = (() => {
  const from = 30 * (Math.PI / 180);
  const to = 44 * (Math.PI / 180);
  const radius = VU_RADIUS + 3;
  const point = (angle: number) => `${VU_CENTER + Math.sin(angle) * radius} ${VU_CENTER - Math.cos(angle) * radius}`;
  return `M ${point(from)} A ${radius} ${radius} 0 0 1 ${point(to)}`;
})();

const FACE_STYLES =
  "relative overflow-hidden rounded-lg bg-(--display) shadow-[inset_0_0_0_1px_var(--divider),inset_0_1px_0_rgb(var(--lift)/calc(var(--lift-top)*0.5))]";

// -- Components ---------------------------------------------------------------

const VuFace: React.FC<{ label: string; needleRef: React.Ref<HTMLDivElement> }> = ({ label, needleRef }) => (
  <div
    className={`${FACE_STYLES} w-[82px] h-12 bg-[radial-gradient(110%_120%_at_50%_100%,var(--lamp-warm),transparent_72%)]`}
  >
    <svg viewBox="0 0 96 56" aria-hidden="true" className="absolute inset-0">
      {VU_TICKS.map((tick) => (
        <line
          key={`${tick.x1}-${tick.y1}`}
          x1={tick.x1}
          y1={tick.y1}
          x2={tick.x2}
          y2={tick.y2}
          strokeWidth={tick.major ? 1.5 : 1}
          strokeLinecap="round"
          className={tick.hot ? "stroke-composer-explicit" : "stroke-(--on-display-dim)"}
        />
      ))}
      <path d={VU_HOT_ARC} strokeWidth={2} fill="none" className="stroke-composer-explicit" />
    </svg>
    <div
      ref={needleRef}
      // react-doctor-disable-next-line react-doctor/no-permanent-will-change -- moved by the frame loop every frame while playing or scrolling, so it needs its own compositor layer
      className="absolute left-1/2 bottom-[7px] w-0.5 h-[29px] -ml-px origin-bottom rotate-[-40deg] rounded-xs bg-linear-to-b from-(--on-display) to-[color-mix(in_oklab,var(--on-display)_55%,transparent)] will-change-[rotate]"
    />
    <div className="absolute left-1/2 bottom-0.5 size-2.5 -ml-[5px] rounded-full bg-(--cap) shadow-(--raised-edge)" />
    <span className="absolute left-[7px] bottom-[5px] font-mono text-[11px] leading-none text-(--on-display-dim)">
      {label}
    </span>
  </div>
);

const MeterBridge: React.FC = () => {
  const { needleRefs, segmentRefs, decibelRef } = useMeterBallistics(SEGMENTS);

  return (
    <div
      role="img"
      aria-label="Output level"
      className="flex gap-1 p-1 rounded-xl bg-(--well) shadow-(--well-edge) select-none"
    >
      {CHANNELS.map((channel, index) => (
        <VuFace key={channel} label={channel} needleRef={needleRefs[index]} />
      ))}
      <div
        className={`${FACE_STYLES} grid grid-cols-[1fr_40px] gap-2.5 w-[188px] h-12 max-[1439px]:hidden py-1.5 pl-2 pr-2.5`}
      >
        <div className="grid content-between min-w-0">
          <div className="grid gap-1">
            {CHANNELS.map((channel, channelIndex) => (
              <div key={channel} className="grid grid-cols-[12px_repeat(16,1fr)] gap-0.5 h-2">
                <b className="font-mono font-medium text-[11px] leading-2 text-(--on-display-dim)">{channel}</b>
                {Array.from({ length: SEGMENTS }, (_, segment) => (
                  <i
                    // biome-ignore lint/suspicious/noArrayIndexKey: segments are a fixed, ordered strip
                    key={segment}
                    ref={(element) => {
                      segmentRefs.current[channelIndex][segment] = element;
                    }}
                    className="rounded-[1.5px] bg-[color-mix(in_oklab,var(--ink)_9%,transparent)] data-[state=on]:bg-[color-mix(in_oklab,var(--color-composer-accent)_85%,var(--ink))] data-[state=hot]:bg-composer-warning data-[state=clip]:bg-composer-explicit data-[state=peak]:bg-composer-accent-text"
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[12px_repeat(4,1fr)] font-mono text-[11px] leading-none tabular-nums text-(--on-display-dim)">
            <span />
            {SCALE_LABELS.map((label) => (
              <span key={label} className="text-right">
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end justify-center gap-[3px] text-[11px] leading-none text-(--on-display-dim) shadow-[-10px_0_0_-9px_var(--divider)]">
          <b ref={decibelRef} className="font-mono font-medium tabular-nums text-(--on-display)" />
          <span>dB</span>
        </div>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { MeterBridge };

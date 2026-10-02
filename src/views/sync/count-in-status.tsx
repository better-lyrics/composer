import { useSyncCountInStore } from "@/stores/sync-count-in";
import { CountdownRing } from "@/ui/countdown-ring";
import { InlineKeyBadge } from "@/ui/inline-key-badge";

// -- Helpers ------------------------------------------------------------------

const announceCountIn = (seconds: number) => `Starting in ${seconds}`;

// -- Components ---------------------------------------------------------------

const CountInStatus: React.FC = () => {
  const endsAt = useSyncCountInStore((s) => s.endsAt);
  const seconds = useSyncCountInStore((s) => s.seconds);
  if (endsAt === null) return null;
  return (
    <div className="flex items-center gap-2.5 text-sm text-composer-text-muted">
      <span aria-hidden="true">Starting in</span>
      <CountdownRing
        remainingSeconds={() => (endsAt - performance.now()) / 1000}
        totalSeconds={seconds}
        precision={0}
        announce={announceCountIn}
      />
      <span aria-hidden="true">・</span>
      <span className="inline-flex items-center">
        <InlineKeyBadge keys={["Esc"]} />
        <span className="ml-1.5">to cancel</span>
      </span>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { CountInStatus };

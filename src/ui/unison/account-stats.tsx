import { levelPercent, xpToNextLevel } from "@/domain/unison/level-progress";
import { useUnisonProfile } from "@/hooks/unison/useUnisonProfile";
import type { UnisonProfileStats } from "@/lib/unison/api-types";
import type { StoredUnisonSession } from "@/lib/unison/session";
import { MenuSeparator } from "@/ui/menu";
import { ProgressBar } from "@/ui/progress-bar";
import { UnisonAvatar } from "@/ui/unison/unison-avatar";

// -- Components ----------------------------------------------------------------

const Stat: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div className="flex flex-col gap-0.5 min-w-0">
    <dt className="text-[11.5px] text-(--muted) truncate">{label}</dt>
    <dd className="text-[15px] font-semibold tabular-nums text-composer-text">{value}</dd>
  </div>
);

const ProfileStats: React.FC<{ stats: UnisonProfileStats }> = ({ stats }) => (
  <div className="flex flex-col gap-3 px-2 pt-1 pb-2">
    <div className="flex flex-col gap-1.5">
      <ProgressBar percent={levelPercent(stats)} label={`Level ${stats.level + 1} progress`} />
      <p className="text-xs tabular-nums text-(--muted) select-text">
        {xpToNextLevel(stats)} XP to level {stats.level + 1}
      </p>
    </div>
    <dl className="grid grid-cols-3 gap-2 select-text">
      <Stat value={stats.submissionCount} label="Lyrics" />
      <Stat value={stats.totalUpvotes} label="Upvotes" />
      <Stat value={stats.fulfilledCount} label="Requests filled" />
    </dl>
  </div>
);

const AccountStats: React.FC<{ session: StoredUnisonSession }> = ({ session }) => {
  const profile = useUnisonProfile(session.keyId).data;
  const stats = profile?.ranked ? profile : null;
  return (
    <>
      <div className="flex items-center gap-3 px-2 pt-1.5 pb-2">
        <UnisonAvatar avatarUrl={session.avatarUrl} size="md" />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-composer-text truncate select-text">{session.displayName}</p>
          <p className="h-4 text-xs tabular-nums text-(--muted) select-text">
            {stats && `Level ${stats.level} ・ Rank ${stats.rank}`}
          </p>
        </div>
      </div>
      {stats && <ProfileStats stats={stats} />}
      <MenuSeparator />
    </>
  );
};

// -- Exports -------------------------------------------------------------------

export { AccountStats };

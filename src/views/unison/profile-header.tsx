import { levelPercent, xpToNextLevel } from "@/domain/unison/level-progress";
import { useUnisonProfile } from "@/hooks/unison/useUnisonProfile";
import type { UnisonMineItem, UnisonProfileBanner, UnisonProfileStats } from "@/lib/unison/api-types";
import type { StoredUnisonSession } from "@/lib/unison/session";
import { KawarpBackdrop } from "@/ui/kawarp-backdrop";
import { UnisonAvatar } from "@/ui/unison/unison-avatar";
import { cn } from "@/utils/cn";

// -- Types ---------------------------------------------------------------------

interface ProfileHeaderProps {
  session: StoredUnisonSession;
  songs: readonly UnisonMineItem[];
}

// -- Constants -----------------------------------------------------------------

const RING_SIZE = 72;
const RING_STROKE = 3;
const RING_CENTER = RING_SIZE / 2;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const CARD = "relative isolate flex items-center gap-5 p-5 rounded-xl select-none max-[900px]:flex-wrap";
const PLAIN_CARD = "pr-6 bg-(--layer-1) shadow-[inset_0_0_0_1px_var(--edge)]";
const BANNER_CARD =
  "group/banner min-h-38 overflow-hidden bg-composer-bg-dark text-white shadow-[inset_0_0_0_1px_var(--edge)]";

// Eased, so the dark side under the text fades into the wash without a visible edge.
const TEXT_SCRIM =
  "bg-[linear-gradient(90deg,rgb(10_9_13/0.72)_0%,rgb(10_9_13/0.7)_22%,rgb(10_9_13/0.64)_32%,rgb(10_9_13/0.54)_41%,rgb(10_9_13/0.42)_49%,rgb(10_9_13/0.3)_57%,rgb(10_9_13/0.19)_65%,rgb(10_9_13/0.1)_73%,rgb(10_9_13/0.04)_81%,rgb(10_9_13/0)_90%)]";
const ART_FADE = "[mask-image:linear-gradient(90deg,transparent_0%,rgb(0_0_0/0.5)_40%,#000_85%)]";

// -- Components ----------------------------------------------------------------

const LevelRing: React.FC<{ percent: number; onMedia: boolean; children: React.ReactNode }> = ({
  percent,
  onMedia,
  children,
}) => (
  <div className="relative grid place-items-center size-[72px] shrink-0">
    <svg aria-hidden="true" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} className="absolute inset-0 -rotate-90">
      <circle
        cx={RING_CENTER}
        cy={RING_CENTER}
        r={RING_RADIUS}
        fill="none"
        strokeWidth={RING_STROKE}
        className={onMedia ? "stroke-white/20" : "stroke-(--layer-3)"}
      />
      {percent > 0 && (
        <circle
          cx={RING_CENTER}
          cy={RING_CENTER}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - Math.min(percent, 100) / 100)}
          className="stroke-composer-accent"
        />
      )}
    </svg>
    {children}
  </div>
);

const HeaderStat: React.FC<{ label: string; value: number; onMedia: boolean }> = ({ label, value, onMedia }) => (
  <div
    className={cn(
      "flex flex-col gap-1 px-6 first:pl-0 last:pr-0 first:shadow-none",
      onMedia ? "shadow-[inset_1px_0_0_rgb(255_255_255/0.07)]" : "shadow-[inset_1px_0_0_var(--divider)]",
    )}
  >
    <dt className={cn("text-[13px] whitespace-nowrap", onMedia ? "text-white/70" : "text-(--muted)")}>{label}</dt>
    <dd className="text-2xl font-bold tabular-nums leading-none tracking-[-0.01em]">{value}</dd>
  </div>
);

const Standing: React.FC<{ stats: UnisonProfileStats }> = ({ stats }) => (
  <>
    Level {stats.level} ・ Rank {stats.rank} ・ {xpToNextLevel(stats)} XP to level {stats.level + 1}
  </>
);

const BannerLayers: React.FC<{ banner: UnisonProfileBanner; song: UnisonMineItem | undefined }> = ({
  banner,
  song,
}) => (
  <>
    <KawarpBackdrop
      src={banner.artworkUrl}
      look="wash"
      className="absolute inset-0 -z-3 overflow-hidden rounded-[inherit] [contain:strict]"
    />
    <img
      alt=""
      src={banner.artworkUrl}
      className={cn("absolute inset-y-0 right-0 w-[46%] h-full object-cover object-[50%_35%] -z-2", ART_FADE)}
    />
    <div aria-hidden="true" className={cn("absolute inset-0 -z-1", TEXT_SCRIM)} />
    {song && (
      <span className="absolute bottom-3 right-3 max-w-[40%] h-6 px-2 flex items-center rounded-[6px] bg-black/40 backdrop-blur-xl text-xs text-white opacity-0 transition-opacity duration-150 group-hover/banner:opacity-100">
        <span className="truncate">
          {song.song} ・ {song.artist}
        </span>
      </span>
    )}
  </>
);

const ProfileStats: React.FC<{ stats: UnisonProfileStats; onMedia: boolean }> = ({ stats, onMedia }) => (
  <dl className="flex select-text">
    <HeaderStat label="Lyrics" value={stats.submissionCount} onMedia={onMedia} />
    <HeaderStat label="Upvotes" value={stats.totalUpvotes} onMedia={onMedia} />
    <HeaderStat label="Requests filled" value={stats.fulfilledCount} onMedia={onMedia} />
  </dl>
);

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ session, songs }) => {
  const profile = useUnisonProfile(session.keyId).data;
  const stats = profile?.ranked ? profile : null;
  const banner = profile?.banner;
  const onMedia = banner !== undefined;
  return (
    <section aria-label="Your Unison profile" className={cn(CARD, onMedia ? BANNER_CARD : PLAIN_CARD)}>
      {banner && <BannerLayers banner={banner} song={songs.find((song) => song.videoId === banner.videoId)} />}
      <LevelRing percent={stats ? levelPercent(stats) : 0} onMedia={onMedia}>
        <UnisonAvatar avatarUrl={session.avatarUrl} size="lg" className="size-[58px]" />
      </LevelRing>
      <div className={cn("flex-1 min-w-0", onMedia && "flex flex-col gap-4")}>
        <div className="min-w-0">
          <h2 className="text-[22px] font-bold leading-[1.15] tracking-[-0.01em] truncate select-text">
            {session.displayName}
          </h2>
          <p
            className={cn(
              "mt-1 h-5 text-[13px] tabular-nums select-text",
              onMedia ? "text-white/70" : "text-(--muted)",
            )}
          >
            {stats && <Standing stats={stats} />}
            {profile && !profile.ranked && "Share lyrics to get a rank"}
          </p>
        </div>
        {stats && onMedia && <ProfileStats stats={stats} onMedia />}
      </div>
      {stats && !onMedia && <ProfileStats stats={stats} onMedia={false} />}
    </section>
  );
};

// -- Exports -------------------------------------------------------------------

export { ProfileHeader };

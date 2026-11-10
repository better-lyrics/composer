import type { Icon } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface BannerTagProps {
  icon: Icon;
  children: React.ReactNode;
}

// -- Components ----------------------------------------------------------------

// The 30% app-background fill keeps 80% text above 4.5:1 on every group colour.
// The banner's 7px radius less its 3px inset gives the 4px radius.
const BannerTag: React.FC<BannerTagProps> = ({ icon: TagIcon, children }) => (
  <span className="flex h-4 min-w-4 shrink-[999] overflow-hidden items-center gap-[3px] ml-1 pl-1 pr-1.5 rounded-[4px] bg-[color-mix(in_oklab,var(--color-composer-bg)_30%,transparent)] text-[10.5px] font-medium text-composer-text/80 whitespace-nowrap">
    <TagIcon aria-hidden="true" stroke={1.75} className="size-3 shrink-0" />
    <span className="truncate">{children}</span>
  </span>
);

// -- Exports -------------------------------------------------------------------

export { BannerTag };

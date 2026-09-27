import { useSettingsStore } from "@/stores/settings";
import {
  type SettingId,
  type SettingsSectionId,
  readSettingOn,
  sectionLabel,
  settingEntry,
} from "@/stores/settings-catalog";
import { type SettingsTarget, useUIStore } from "@/stores/ui";
import { SettingLinkContext } from "@/ui/setting-link-context";
import { cn } from "@/utils/cn";
import { IconArrowUpRight, IconChevronRight } from "@tabler/icons-react";
import { useContext } from "react";

// -- Types ---------------------------------------------------------------------

type SettingLinkProps = { setting: SettingId } | { section: SettingsSectionId };

interface SettingChipProps {
  target: SettingsTarget;
  ariaLabel: string;
  label: string;
  crumb?: SettingsSectionId;
  stateMark?: React.ReactNode;
}

// -- Styles --------------------------------------------------------------------

const CHIP_STYLES =
  "group inline-flex items-center align-baseline mx-px pl-1.5 pr-2 rounded-md whitespace-nowrap select-none cursor-pointer text-[0.93em] font-medium leading-[1.45] text-composer-accent-text bg-composer-accent/13 ring-1 ring-inset ring-composer-accent/22 hover:bg-composer-accent/22 active:scale-[0.96] transition-[background-color,scale] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-composer-accent";

const ARROW_STYLES =
  "w-0 opacity-0 scale-25 blur-[4px] transition-[width,margin,opacity,scale,filter] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:ml-0.5 group-hover:w-3 group-hover:opacity-100 group-hover:scale-100 group-hover:blur-none group-focus-visible:ml-0.5 group-focus-visible:w-3 group-focus-visible:opacity-100 group-focus-visible:scale-100 group-focus-visible:blur-none motion-reduce:transition-none";

// -- Components ----------------------------------------------------------------

const Crumb: React.FC<{ section: SettingsSectionId }> = ({ section }) => (
  <>
    <span className="font-normal text-composer-accent-text/60">{sectionLabel(section)}</span>
    <IconChevronRight size={11} className="mx-0.5 opacity-50" aria-hidden="true" />
  </>
);

const SettingChip: React.FC<SettingChipProps> = ({ target, ariaLabel, label, crumb, stateMark }) => {
  const host = useContext(SettingLinkContext);
  if (!host) return <span className="font-medium text-composer-text">{label}</span>;

  const openTarget = () => useUIStore.getState().openSettings({ target, returnTo: host.returnPoint() });

  return (
    <button type="button" onClick={openTarget} aria-label={ariaLabel} className={CHIP_STYLES}>
      {crumb && <Crumb section={crumb} />}
      {label}
      {stateMark}
      <IconArrowUpRight size={12} aria-hidden="true" className={ARROW_STYLES} />
    </button>
  );
};

const SettingTargetLink: React.FC<{ setting: SettingId }> = ({ setting }) => {
  const { label, section } = settingEntry(setting);
  const isOn = useSettingsStore((state) => readSettingOn(setting, state));
  const valueSuffix = isOn === null ? "" : isOn ? ", on" : ", off";
  const stateMark =
    isOn === null ? undefined : (
      <span
        data-setting-state={isOn ? "on" : "off"}
        aria-hidden="true"
        className={cn(
          "ml-1 inline-block size-[7px] rounded-[2px]",
          isOn ? "bg-composer-accent-text" : "ring-[1.25px] ring-inset ring-composer-accent-text",
        )}
      />
    );

  return (
    <SettingChip
      target={{ setting }}
      ariaLabel={`Open setting ${label}${valueSuffix}`}
      label={label}
      crumb={section}
      stateMark={stateMark}
    />
  );
};

const SectionTargetLink: React.FC<{ section: SettingsSectionId }> = ({ section }) => (
  <SettingChip
    target={{ section }}
    ariaLabel={`Open ${sectionLabel(section)} settings`}
    label={sectionLabel(section)}
  />
);

const SettingLink: React.FC<SettingLinkProps> = (props) =>
  "setting" in props ? <SettingTargetLink setting={props.setting} /> : <SectionTargetLink section={props.section} />;

// -- Exports -------------------------------------------------------------------

export { SettingLink };

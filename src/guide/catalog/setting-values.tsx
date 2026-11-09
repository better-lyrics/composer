import { useSettingsStore } from "@/stores/settings";
import { pluralWord } from "@/utils/pluralize";

// -- Components ---------------------------------------------------------------

// Copy names the amounts you set, so a tip never says "a bit" when the app knows how far.
const SeekStep: React.FC = () => {
  const seconds = useSettingsStore((state) => state.seekStep);
  return <>{`${seconds} ${pluralWord(seconds, "second")}`}</>;
};

const NudgeAmount: React.FC = () => {
  const seconds = useSettingsStore((state) => state.nudgeAmount);
  return <>{`${Math.round(seconds * 1000)} ms`}</>;
};

// -- Exports ------------------------------------------------------------------

export { NudgeAmount, SeekStep };

import type { HelpLocation } from "@/stores/ui";
import { createContext } from "react";

// -- Types ---------------------------------------------------------------------

interface SettingLinkHost {
  returnPoint: () => HelpLocation | undefined;
}

// -- Context -------------------------------------------------------------------

const SettingLinkContext = createContext<SettingLinkHost | null>(null);

const APP_SETTING_LINK_HOST: SettingLinkHost = { returnPoint: () => undefined };

// -- Exports -------------------------------------------------------------------

export { APP_SETTING_LINK_HOST, SettingLinkContext };
export type { SettingLinkHost };

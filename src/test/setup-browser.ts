import { beforeEach } from "vitest";
import { resetAllStores } from "@/test/stores";
import { registerConsoleGuard, addGlobalAllowedConsolePattern } from "@/test/console-guard";

beforeEach(async () => {
  await resetAllStores();
});

addGlobalAllowedConsolePattern(/Reduced Motion enabled/);
addGlobalAllowedConsolePattern(/React Router Future Flag Warning/);
addGlobalAllowedConsolePattern(/v7_startTransition/);
registerConsoleGuard();

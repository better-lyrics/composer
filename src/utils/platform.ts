const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

const MOD_KEY = isMac ? "Cmd" : "Ctrl";
const ALT_KEY = isMac ? "Option" : "Alt";

interface NavigatorUABrand {
  brand: string;
  version: string;
}

interface NavigatorUserAgentData {
  brands?: NavigatorUABrand[];
}

function isChromiumBrands(brands: NavigatorUABrand[] | undefined): boolean {
  return brands?.some((entry) => entry.brand === "Chromium") ?? false;
}

type BrowserKind = "chromium" | "other";

const isChromium =
  typeof navigator !== "undefined" &&
  isChromiumBrands((navigator as Navigator & { userAgentData?: NavigatorUserAgentData }).userAgentData?.brands);

const BROWSER_KIND: BrowserKind = isChromium ? "chromium" : "other";

export type { BrowserKind };
export { isMac, MOD_KEY, ALT_KEY, isChromiumBrands, BROWSER_KIND };

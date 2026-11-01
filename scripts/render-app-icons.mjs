import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOGO = readFileSync(resolve(ROOT, "public/logo.svg"), "utf8").replace(/^<\?xml[^>]*>\s*/, "");
const APP_BACKGROUND = "#28292c";
// Maskable icons keep their content inside the central 80% circle; 60% leaves margin on every OS mask.
const MASKABLE_LOGO_SCALE = 0.6;

const ICONS = [
  { file: "icon-192.png", size: 192, background: null, scale: 1 },
  { file: "icon-512.png", size: 512, background: null, scale: 1 },
  { file: "icon-maskable-512.png", size: 512, background: APP_BACKGROUND, scale: MASKABLE_LOGO_SCALE },
];

function iconPage({ size, background, scale }) {
  const logoSize = Math.round(size * scale);
  return `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${background ?? "transparent"}"><div style="width:${logoSize}px;height:${logoSize}px">${LOGO}</div></body></html>`;
}

const browser = await chromium.launch();
try {
  for (const icon of ICONS) {
    const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size } });
    await page.setContent(iconPage(icon));
    await page.screenshot({ path: resolve(ROOT, "public/icons", icon.file), omitBackground: icon.background === null });
    await page.close();
  }
} finally {
  await browser.close();
}

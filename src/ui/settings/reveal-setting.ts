import type { SettingId } from "@/stores/settings-catalog";

// -- Reveal --------------------------------------------------------------------

function revealSetting(viewport: HTMLElement, id: SettingId): void {
  const row = viewport.querySelector<HTMLElement>(`[data-setting-id="${id}"]`);
  if (!row) return;
  const rowTopInViewport = row.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
  viewport.scrollTop += rowTopInViewport - (viewport.clientHeight - row.offsetHeight) / 2;
  row.setAttribute("data-nudge", "");
  row.addEventListener("animationend", () => row.removeAttribute("data-nudge"), { once: true });
}

// -- Exports -------------------------------------------------------------------

export { revealSetting };

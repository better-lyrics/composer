// -- Reveal --------------------------------------------------------------------

function revealElement(viewport: HTMLElement, element: HTMLElement): void {
  const topInViewport = element.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
  viewport.scrollTop += topInViewport - (viewport.clientHeight - element.offsetHeight) / 2;
  element.setAttribute("data-nudge", "");
  element.addEventListener("animationend", () => element.removeAttribute("data-nudge"), { once: true });
}

// -- Exports -------------------------------------------------------------------

export { revealElement };

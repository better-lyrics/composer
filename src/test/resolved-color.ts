// -- Helpers -------------------------------------------------------------------

function resolvedColor(cssColor: string): string {
  const probe = document.createElement("span");
  probe.style.color = cssColor;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

// -- Exports -------------------------------------------------------------------

export { resolvedColor };

// -- Functions ----------------------------------------------------------------

// The line column's singer edge: dimmed at rest, the full singer colour on the line being heard.
function lineColumnRail(agentColor: string, lit: boolean): string {
  return lit ? agentColor : `color-mix(in oklab, ${agentColor} 45%, var(--gutter-bg))`;
}

function lineColumnTint(agentColor: string): string {
  return `color-mix(in oklab, ${agentColor} 8%, var(--gutter-bg))`;
}

// -- Exports ------------------------------------------------------------------

export { lineColumnRail, lineColumnTint };

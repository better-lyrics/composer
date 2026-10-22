import { getAgentColor } from "@/domain/agent/colors";

// -- Functions ----------------------------------------------------------------

// The line column's singer edge: dimmed at rest, the full singer colour on the line being heard.
function lineColumnRail(agentColor: string, lit: boolean): string {
  return lit ? agentColor : `color-mix(in oklab, ${agentColor} 45%, var(--gutter-bg))`;
}

function lineColumnTint(agentColor: string): string {
  return `color-mix(in oklab, ${agentColor} 8%, var(--gutter-bg))`;
}

// The resting line column for a line's singer, as a style on the column element.
function lineColumnStyle(agentId: string): React.CSSProperties {
  const color = getAgentColor(agentId);
  return { background: lineColumnTint(color), borderRightColor: lineColumnRail(color, false) };
}

// -- Exports ------------------------------------------------------------------

export { lineColumnRail, lineColumnStyle, lineColumnTint };

// -- Derivations --------------------------------------------------------------

function nextAgentId(existingAgents: readonly { id: string }[]): string {
  const usedNumbers = new Set<number>();
  for (const agent of existingAgents) {
    const match = agent.id.match(/^v(\d+)$/);
    if (match) usedNumbers.add(Number.parseInt(match[1], 10));
  }
  let next = 1;
  while (usedNumbers.has(next)) next++;
  return `v${next}`;
}

// -- Exports ------------------------------------------------------------------

export { nextAgentId };

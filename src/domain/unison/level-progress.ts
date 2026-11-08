// -- Types ---------------------------------------------------------------------

interface LevelStanding {
  level: number;
  xp: number;
  xpFloor: number;
  xpForNext: number;
}

// -- Functions -----------------------------------------------------------------

function levelPercent({ xp, xpFloor, xpForNext }: LevelStanding): number {
  return xpForNext > xpFloor ? ((xp - xpFloor) / (xpForNext - xpFloor)) * 100 : 100;
}

function xpToNextLevel({ xp, xpForNext }: LevelStanding): number {
  return Math.max(0, xpForNext - xp);
}

// -- Exports -------------------------------------------------------------------

export { levelPercent, xpToNextLevel };

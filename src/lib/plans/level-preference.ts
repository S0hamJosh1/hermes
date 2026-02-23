export function clampOffset(offset: number): number {
  return Math.max(-6, Math.min(6, offset));
}

export function difficultyLabel(offset: number): string {
  if (offset <= -2) return "much easier";
  if (offset === -1) return "slightly easier";
  if (offset === 0) return "auto";
  if (offset === 1) return "slightly harder";
  return "much harder";
}

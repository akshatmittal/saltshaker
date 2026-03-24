import type { MiningResult } from "../../types";

function compareResults(left: MiningResult, right: MiningResult): number {
  return right.score - left.score;
}

export function mergeResult(current: MiningResult[], candidate: MiningResult, maxResults: number): MiningResult[] {
  const existingIndex = current.findIndex(
    (entry) => entry.address === candidate.address && entry.nonce === candidate.nonce,
  );

  if (existingIndex >= 0) {
    const existing = current[existingIndex]!;
    if (existing.score === candidate.score && existing.leadingZeroNibbles === candidate.leadingZeroNibbles) {
      return current;
    }
  }

  const next =
    existingIndex >= 0
      ? current.map((entry, index) => (index === existingIndex ? candidate : entry))
      : [...current, candidate];

  next.sort(compareResults);
  return next.slice(0, maxResults);
}

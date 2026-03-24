import { getAddress } from "viem";
import { describe, expect, it } from "vitest";

import { mergeCandidate, prepareMatcher, scoreAddress } from "./matchers";
import type { MiningCandidate } from "./types";

const PATTERN_ADDRESS = getAddress("0x0123456789abcdef0123456789abcdef01234567");
const ZERO_HEAVY_ADDRESS = getAddress("0x000f123456789abcdef0123456789abcdef01234");

function createCandidate(address: `0x${string}`, nonce: bigint, score: number): MiningCandidate {
  return {
    protocol: "create2",
    nonce,
    salt: "0x" as const,
    address,
    score,
    leadingZeroNibbles: 0,
  };
}

describe("prepareMatcher", () => {
  it("accepts odd-length hex patterns at nibble precision", () => {
    const matcher = prepareMatcher({ type: "prefix", value: "0xabc" });

    expect(matcher.valueHex).toBe("0xabc");
    expect(matcher.nibbleLength).toBe(3);
    expect([...matcher.valueNibbles]).toEqual([10, 11, 12]);
  });

  it("rejects empty scored pattern matchers", () => {
    expect(() => prepareMatcher({ type: "contains", value: "0x" })).toThrow(
      "Contains matcher must contain at least one hex nibble",
    );
  });
});

describe("scoreAddress", () => {
  it("scores prefix matches by contiguous leading nibble length", () => {
    const matcher = prepareMatcher({ type: "prefix", value: "0x01239" });

    expect(scoreAddress(PATTERN_ADDRESS, matcher)).toBe(4);
  });

  it("scores suffix matches by contiguous trailing nibble length", () => {
    const matcher = prepareMatcher({ type: "suffix", value: "0x14567" });

    expect(scoreAddress(PATTERN_ADDRESS, matcher)).toBe(4);
  });

  it("scores contains matches by longest common substring length", () => {
    const matcher = prepareMatcher({ type: "contains", value: "0x89abff" });

    expect(scoreAddress(PATTERN_ADDRESS, matcher)).toBe(4);
  });

  it("uses leading-zero count when the threshold is met", () => {
    const matcher = prepareMatcher({ type: "leadingZeros", value: 3 });

    expect(scoreAddress(ZERO_HEAVY_ADDRESS, matcher)).toBe(1);
  });

  it("keeps leading-zero ranking monotonic above the threshold", () => {
    const matcher = prepareMatcher({ type: "leadingZeros", value: 2 });
    const stronger = getAddress("0x0000f123456789abcdef0123456789abcdef0123");

    expect(scoreAddress(stronger, matcher)).toBeGreaterThan(scoreAddress(ZERO_HEAVY_ADDRESS, matcher));
  });

  it("returns zero when a leading-zero threshold is not met", () => {
    const matcher = prepareMatcher({ type: "leadingZeros", value: 4 });

    expect(scoreAddress(ZERO_HEAVY_ADDRESS, matcher)).toBe(0);
  });
});

describe("mergeCandidate", () => {
  it("keeps first-seen order for equal scores", () => {
    const first = createCandidate(getAddress("0x1000000000000000000000000000000000000000"), 1n, 5);
    const second = createCandidate(getAddress("0x2000000000000000000000000000000000000000"), 2n, 5);

    const merged = mergeCandidate(mergeCandidate([], first, 10), second, 10);

    expect(merged.map((candidate) => candidate.address)).toEqual([first.address, second.address]);
  });

  it("does not reorder an unchanged duplicate candidate", () => {
    const first = createCandidate(getAddress("0x1000000000000000000000000000000000000000"), 1n, 5);
    const second = createCandidate(getAddress("0x2000000000000000000000000000000000000000"), 2n, 5);
    const current = mergeCandidate(mergeCandidate([], first, 10), second, 10);

    const merged = mergeCandidate(current, first, 10);

    expect(merged).toBe(current);
  });

  it("ranks higher scores ahead of lower scores", () => {
    const high = createCandidate(getAddress("0x3000000000000000000000000000000000000000"), 3n, 8);
    const low = createCandidate(getAddress("0x4000000000000000000000000000000000000000"), 4n, 2);

    const merged = mergeCandidate(mergeCandidate([], low, 10), high, 10);

    expect(merged.map((candidate) => candidate.address)).toEqual([high.address, low.address]);
  });
});

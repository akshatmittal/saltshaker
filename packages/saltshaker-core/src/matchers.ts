import type { Address } from "viem";

import type { AddressMatcherSpec, MiningCandidate, PreparedAddressMatcher } from "./types";
import { assert, countLeadingZeroNibbles, hexToNibbles, normalizeNibbleHex } from "./utils";

const EMPTY_MATCHER_HEX = "0x";
const EMPTY_MATCHER_NIBBLES = new Uint8Array();

const HEX_MATCHER_LABELS = {
  prefix: "Prefix",
  suffix: "Suffix",
  contains: "Contains",
} as const;

function prepareHexMatcher(type: "prefix" | "suffix" | "contains", value: string): PreparedAddressMatcher {
  const label = HEX_MATCHER_LABELS[type];
  const valueHex = normalizeNibbleHex(value, label);
  const valueNibbles = hexToNibbles(valueHex);
  assert(valueNibbles.length > 0, `${label} matcher must contain at least one hex nibble`);
  assert(valueNibbles.length <= 40, `${label} matcher must be 20 bytes or shorter`);

  return {
    type,
    valueHex,
    valueNibbles,
    nibbleLength: valueNibbles.length,
    leadingZeroNibbles: 0,
  };
}

function createLeadingZerosMatcher(leadingZeroNibbles: number): PreparedAddressMatcher {
  return {
    type: "leadingZeros",
    valueHex: EMPTY_MATCHER_HEX,
    valueNibbles: EMPTY_MATCHER_NIBBLES,
    nibbleLength: 0,
    leadingZeroNibbles,
  };
}

export function prepareMatcher(spec: AddressMatcherSpec = { type: "leadingZeros", value: 0 }): PreparedAddressMatcher {
  switch (spec.type) {
    case "prefix":
      return prepareHexMatcher("prefix", spec.value);
    case "suffix":
      return prepareHexMatcher("suffix", spec.value);
    case "contains":
      return prepareHexMatcher("contains", spec.value);
    case "leadingZeros":
      assert(Number.isFinite(spec.value), "Leading zero matcher must be a finite number");
      return createLeadingZerosMatcher(Math.min(40, Math.max(0, Math.floor(spec.value))));
  }
}

function scorePrefix(addressHex: string, valueHex: string): number {
  let score = 0;

  for (let index = 0; index < valueHex.length; index += 1) {
    if (addressHex[index] !== valueHex[index]) {
      break;
    }
    score += 1;
  }

  return score;
}

function scoreSuffix(addressHex: string, valueHex: string): number {
  let score = 0;

  for (let index = 1; index <= valueHex.length; index += 1) {
    if (addressHex.at(-index) !== valueHex.at(-index)) {
      break;
    }
    score += 1;
  }

  return score;
}

function scoreContains(addressHex: string, valueHex: string): number {
  if (valueHex.length === 0) {
    return 0;
  }

  const previous = new Uint8Array(valueHex.length + 1);
  const current = new Uint8Array(valueHex.length + 1);
  let best = 0;

  for (let addressIndex = 1; addressIndex <= addressHex.length; addressIndex += 1) {
    for (let valueIndex = 1; valueIndex <= valueHex.length; valueIndex += 1) {
      if (addressHex[addressIndex - 1] === valueHex[valueIndex - 1]) {
        const next = previous[valueIndex - 1]! + 1;
        current[valueIndex] = next;
        if (next > best) {
          best = next;
        }
      } else {
        current[valueIndex] = 0;
      }
    }

    previous.set(current);
    current.fill(0);
  }

  return best;
}

export function scoreAddress(address: Address, matcher: PreparedAddressMatcher): number {
  const lower = address.slice(2).toLowerCase();
  const value = matcher.valueHex.slice(2).toLowerCase();

  switch (matcher.type) {
    case "prefix":
      return scorePrefix(lower, value);
    case "suffix":
      return scoreSuffix(lower, value);
    case "contains":
      return scoreContains(lower, value);
    case "leadingZeros": {
      const zeroCount = countLeadingZeroNibbles(address);
      return zeroCount >= matcher.leadingZeroNibbles ? zeroCount - matcher.leadingZeroNibbles + 1 : 0;
    }
  }
}

export function compareCandidates(a: MiningCandidate, b: MiningCandidate): number {
  return b.score - a.score;
}

export function mergeCandidate(
  current: MiningCandidate[],
  candidate: MiningCandidate,
  maxResults: number,
): MiningCandidate[] {
  const existingIndex = current.findIndex((entry) => entry.address === candidate.address && entry.nonce === candidate.nonce);
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
  next.sort(compareCandidates);
  return next.slice(0, maxResults);
}

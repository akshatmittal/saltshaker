import type { Address } from "viem";

import type { AddressMatcherSpec, MiningCandidate, PreparedAddressMatcher } from "./types";
import { assert, compareAddressNumeric, countLeadingZeroNibbles, hexToBytes, normalizeHex } from "./utils";

const EMPTY_MATCHER_HEX = "0x";
const EMPTY_MATCHER_BYTES = new Uint8Array();

const HEX_MATCHER_LABELS = {
  prefix: "Prefix",
  suffix: "Suffix",
  contains: "Contains",
} as const;

function prepareHexMatcher(type: "prefix" | "suffix" | "contains", value: string): PreparedAddressMatcher {
  const label = HEX_MATCHER_LABELS[type];
  const valueHex = normalizeHex(value, label);
  const valueBytes = hexToBytes(valueHex);
  assert(valueBytes.length <= 20, `${label} matcher must be 20 bytes or shorter`);

  return {
    type,
    valueHex,
    valueBytes,
    leadingZeroNibbles: 0,
  };
}

function createLeadingZerosMatcher(leadingZeroNibbles: number): PreparedAddressMatcher {
  return {
    type: "leadingZeros",
    valueHex: EMPTY_MATCHER_HEX,
    valueBytes: EMPTY_MATCHER_BYTES,
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

export function matchesAddress(address: Address, matcher: PreparedAddressMatcher): boolean {
  const lower = address.slice(2).toLowerCase();
  const value = matcher.valueHex.slice(2).toLowerCase();

  switch (matcher.type) {
    case "prefix":
      return lower.startsWith(value);
    case "suffix":
      return lower.endsWith(value);
    case "contains":
      return lower.includes(value);
    case "leadingZeros":
      return countLeadingZeroNibbles(address) >= matcher.leadingZeroNibbles;
  }
}

export function compareCandidates(a: MiningCandidate, b: MiningCandidate): number {
  if (a.leadingZeroNibbles !== b.leadingZeroNibbles) {
    return b.leadingZeroNibbles - a.leadingZeroNibbles;
  }
  return compareAddressNumeric(a.address, b.address);
}

export function mergeCandidate(
  current: MiningCandidate[],
  candidate: MiningCandidate,
  maxResults: number,
): MiningCandidate[] {
  const next = current.filter((entry) => entry.address !== candidate.address || entry.nonce !== candidate.nonce);
  next.push(candidate);
  next.sort(compareCandidates);
  return next.slice(0, maxResults);
}

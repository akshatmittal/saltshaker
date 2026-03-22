import type { Address } from "viem";

import type { AddressMatcherSpec, MiningCandidate, PreparedAddressMatcher } from "./types";
import { assert, compareAddressNumeric, countLeadingZeroNibbles, hexToBytes, normalizeHex } from "./utils";

function prepareHexMatcher(type: "prefix" | "suffix" | "contains", value: string): PreparedAddressMatcher {
  const label = type === "contains" ? "Contains" : type === "prefix" ? "Prefix" : "Suffix";
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

export function prepareMatcher(spec: AddressMatcherSpec = {}): PreparedAddressMatcher {
  switch (spec.type) {
    case "prefix":
      return prepareHexMatcher("prefix", spec.value);
    case "suffix":
      return prepareHexMatcher("suffix", spec.value);
    case "contains":
      return prepareHexMatcher("contains", spec.value);
    case "leadingZeros":
      assert(Number.isFinite(spec.value), "Leading zero matcher must be a finite number");
      return {
        type: "leadingZeros",
        valueHex: "0x",
        valueBytes: new Uint8Array(),
        leadingZeroNibbles: Math.min(40, Math.max(0, Math.floor(spec.value))),
      };
    case "none":
    default:
      return {
        type: "none",
        valueHex: "0x",
        valueBytes: new Uint8Array(),
        leadingZeroNibbles: 0,
      };
  }
}

export function matchesAddress(address: Address, matcher: PreparedAddressMatcher): boolean {
  const lower = address.slice(2).toLowerCase();
  switch (matcher.type) {
    case "none":
      return true;
    case "prefix":
      return lower.startsWith(matcher.valueHex.slice(2).toLowerCase());
    case "suffix":
      return lower.endsWith(matcher.valueHex.slice(2).toLowerCase());
    case "contains":
      return lower.includes(matcher.valueHex.slice(2).toLowerCase());
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

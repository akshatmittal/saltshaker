import { getAddress, isAddress, type Address, type Hex } from "viem";

import { assert } from "./assert";

export function ensureAddress(value: string, label: string): Address {
  assert(isAddress(value), `${label} must be a valid address`);
  return getAddress(value);
}

export function countLeadingZeroNibbles(address: Address): number {
  const hex = address.slice(2).toLowerCase();
  let count = 0;

  for (const char of hex) {
    if (char !== "0") {
      break;
    }
    count += 1;
  }

  return count;
}

export function addressFromHash(hash: Hex): Address {
  return getAddress(`0x${hash.slice(-40)}`);
}

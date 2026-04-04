import type { Address } from "viem";

import type { PreparedMatcher } from "../types";

import { countLeadingZeroNibbles } from "../address";

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

export function scoreAddress(address: Address, matcher: PreparedMatcher): number {
  if (matcher.type === "leadingZeros") {
    const zeroCount = countLeadingZeroNibbles(address);
    return zeroCount >= matcher.minZeroNibbles ? zeroCount : 0;
  }

  const addressHex = address.slice(2).toLowerCase();
  const valueHex = matcher.valueHex.slice(2);

  switch (matcher.type) {
    case "prefix":
      return scorePrefix(addressHex, valueHex);
    case "suffix":
      return scoreSuffix(addressHex, valueHex);
    case "contains":
      return scoreContains(addressHex, valueHex);
  }
}

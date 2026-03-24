import type { AddressMatcherSpec } from "../../types";
import type { PreparedMatcher } from "../types";
import { assert } from "../assert";
import { hexToNibbles, normalizeNibbleHex } from "../hex";

const EMPTY_MATCHER_HEX = "0x";
const EMPTY_NIBBLES = new Uint8Array();

const HEX_MATCHER_LABELS = {
  prefix: "Prefix",
  suffix: "Suffix",
  contains: "Contains",
} as const;

function preparePatternMatcher(type: "prefix" | "suffix" | "contains", value: string): PreparedMatcher {
  const label = HEX_MATCHER_LABELS[type];
  const valueHex = normalizeNibbleHex(value, label);
  const nibbles = hexToNibbles(valueHex);

  assert(nibbles.length > 0, `${label} matcher must contain at least one hex nibble`);
  assert(nibbles.length <= 40, `${label} matcher must be 20 bytes or shorter`);

  return { type, valueHex, nibbles };
}

export function prepareMatcher(spec: AddressMatcherSpec = { type: "leadingZeros", value: 8 }): PreparedMatcher {
  switch (spec.type) {
    case "prefix":
    case "suffix":
    case "contains":
      return preparePatternMatcher(spec.type, spec.value);
    case "leadingZeros":
      assert(Number.isFinite(spec.value), "Leading zero matcher must be a finite number");
      return {
        type: "leadingZeros",
        minZeroNibbles: Math.min(40, Math.max(0, Math.floor(spec.value))),
      };
  }
}

export const EMPTY_PATTERN = {
  valueHex: EMPTY_MATCHER_HEX,
  nibbles: EMPTY_NIBBLES,
} as const;

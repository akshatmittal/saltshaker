import { toBytes, toHex, type Hex } from "viem";

import { assert } from "./assert";

export function normalizeHex(value: Hex | string, label: string): Hex {
  const prefixed = value.startsWith("0x") ? value : `0x${value}`;
  assert(/^0x[0-9a-fA-F]*$/.test(prefixed), `${label} must be a hex string`);
  assert((prefixed.length - 2) % 2 === 0, `${label} must have an even number of hex characters`);
  return prefixed as Hex;
}

export function normalizeNibbleHex(value: Hex | string, label: string): `0x${string}` {
  const prefixed = value.startsWith("0x") ? value : `0x${value}`;
  assert(/^0x[0-9a-fA-F]*$/.test(prefixed), `${label} must be a hex string`);
  return prefixed.toLowerCase() as `0x${string}`;
}

export function hexToBytes(hex: Hex | string): Uint8Array {
  return toBytes(normalizeHex(hex, "Hex value"));
}

export function hexToNibbles(hex: Hex | string): Uint8Array {
  const normalized = normalizeNibbleHex(hex, "Hex value");
  const nibbles = new Uint8Array(normalized.length - 2);

  for (let index = 0; index < nibbles.length; index += 1) {
    nibbles[index] = Number.parseInt(normalized[index + 2]!, 16);
  }

  return nibbles;
}

export function bytesToHex(bytes: Uint8Array): Hex {
  return toHex(bytes);
}

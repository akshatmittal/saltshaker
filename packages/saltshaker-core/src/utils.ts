import { getAddress, isAddress, keccak256, type Address, type Hex } from "viem";

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function normalizeHex(value: Hex | string, label: string): Hex {
  const prefixed = value.startsWith("0x") ? value : `0x${value}`;
  assert(/^0x[0-9a-fA-F]*$/.test(prefixed), `${label} must be a hex string`);
  assert((prefixed.length - 2) % 2 === 0, `${label} must have an even number of hex characters`);
  return prefixed as Hex;
}

export function ensureAddress(value: string, label: string): Address {
  assert(isAddress(value), `${label} must be a valid address`);
  return getAddress(value);
}

export function hexToBytes(hex: Hex | string): Uint8Array {
  const normalized = normalizeHex(hex, "Hex value");
  const bytes = new Uint8Array((normalized.length - 2) / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(2 + index * 2, 4 + index * 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): Hex {
  let out = "0x";
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, "0");
  }
  return out as Hex;
}

export function packBytesToWordsLE(bytes: Uint8Array, wordCount: number): Uint32Array {
  const words = new Uint32Array(wordCount);
  for (let index = 0; index < bytes.length; index += 1) {
    const wordIndex = Math.floor(index / 4);
    words[wordIndex] = (words[wordIndex] ?? 0) | (bytes[index]! << ((index % 4) * 8));
  }
  return words;
}

export function splitBigIntToU32(value: bigint): [number, number] {
  const masked = BigInt.asUintN(64, value);
  const low = Number(masked & 0xffff_ffffn);
  const high = Number((masked >> 32n) & 0xffff_ffffn);
  return [low, high];
}

export function writeBigEndianNonce(target: Uint8Array, offset: number, value: bigint, byteLength: number): void {
  const masked = BigInt.asUintN(byteLength * 8, value);
  for (let index = 0; index < byteLength; index += 1) {
    const shift = BigInt((byteLength - 1 - index) * 8);
    target[offset + index] = Number((masked >> shift) & 0xffn);
  }
}

export function countLeadingZeroNibbles(address: Address): number {
  const hex = address.slice(2).toLowerCase();
  let count = 0;
  for (const char of hex) {
    if (char === "0") {
      count += 1;
      continue;
    }
    break;
  }
  return count;
}

export function compareAddressNumeric(a: Address, b: Address): number {
  const left = BigInt(a.toLowerCase());
  const right = BigInt(b.toLowerCase());
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function addressFromHash(hash: Hex): Address {
  return getAddress(`0x${hash.slice(-40)}`);
}

export function keccakHex(hex: Hex): Hex {
  return keccak256(hex);
}

export function addressWordsToHex(words: Uint32Array): Address {
  const bytes = new Uint8Array(20);
  for (let wordIndex = 0; wordIndex < 5; wordIndex += 1) {
    const word = words[wordIndex]!;
    const base = wordIndex * 4;
    bytes[base] = word & 0xff;
    bytes[base + 1] = (word >>> 8) & 0xff;
    bytes[base + 2] = (word >>> 16) & 0xff;
    bytes[base + 3] = (word >>> 24) & 0xff;
  }
  return getAddress(bytesToHex(bytes));
}

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
  return [Number(masked & 0xffff_ffffn), Number((masked >> 32n) & 0xffff_ffffn)];
}

export function writeBigEndianNonce(target: Uint8Array, offset: number, value: bigint, byteLength: number): void {
  const masked = BigInt.asUintN(byteLength * 8, value);

  for (let index = 0; index < byteLength; index += 1) {
    const shift = BigInt((byteLength - 1 - index) * 8);
    target[offset + index] = Number((masked >> shift) & 0xffn);
  }
}

export function toGpuBufferSource(words: Uint32Array): ArrayBufferView<ArrayBuffer> {
  const buffer = new ArrayBuffer(words.byteLength);
  new Uint8Array(buffer).set(new Uint8Array(words.buffer, words.byteOffset, words.byteLength));
  return new Uint8Array(buffer) as ArrayBufferView<ArrayBuffer>;
}

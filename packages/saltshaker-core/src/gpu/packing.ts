import type { PreparedJob, PreparedMatcher } from "../internal/types";

import { packBytesToWordsLE } from "../internal/words";

const RESULT_WORDS = 8;
const PATTERN_WORDS = 10;

function buildMatcherWords(matcher: PreparedMatcher): Uint32Array {
  if (matcher.type === "leadingZeros") {
    return new Uint32Array([matcher.minZeroNibbles]);
  }

  const words = new Uint32Array(PATTERN_WORDS + 1);
  words.set(packBytesToWordsLE(matcher.nibbles, PATTERN_WORDS), 0);
  words[PATTERN_WORDS] = matcher.nibbles.length;
  return words;
}

function buildJobWords(job: PreparedJob): Uint32Array {
  if (job.protocol === "create2") {
    const words = new Uint32Array(19);
    words.set(packBytesToWordsLE(job.deployerBytes, 5), 0);
    words.set(packBytesToWordsLE(job.fixedSaltPrefixBytes, 6), 5);
    words.set(packBytesToWordsLE(job.initCodeHashBytes, 8), 11);
    return words;
  }

  const words = new Uint32Array(21);
  words.set(packBytesToWordsLE(job.initializerHashBytes, 8), 0);
  words.set(packBytesToWordsLE(job.factoryBytes, 5), 8);
  words.set(packBytesToWordsLE(job.proxyCreationCodeHashBytes, 8), 13);
  return words;
}

export function buildConstantsWords(job: PreparedJob, matcher: PreparedMatcher): Uint32Array {
  const jobWords = buildJobWords(job);
  const matcherWords = buildMatcherWords(matcher);
  const words = new Uint32Array(jobWords.length + matcherWords.length);
  words.set(jobWords, 0);
  words.set(matcherWords, jobWords.length);
  return words;
}

export function createEmptyResultWords(): Uint32Array {
  const words = new Uint32Array(RESULT_WORDS);
  words[2] = 0xffff_ffff;
  words[3] = 0xffff_ffff;
  words[4] = 0xffff_ffff;
  words[5] = 0xffff_ffff;
  words[6] = 0xffff_ffff;
  return words;
}

export function decodeResultWords(words: Uint32Array): { nonce: bigint; score: number } | null {
  const score = words[7] ?? 0;
  if (score === 0) {
    return null;
  }

  return {
    nonce: (BigInt(words[1]!) << 32n) | BigInt(words[0]!),
    score,
  };
}

export const RESULT_BUFFER_SIZE = RESULT_WORDS * 4;

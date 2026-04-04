import { concat, encodeFunctionData, getAddress, keccak256, pad, toHex, type Hex } from "viem";

import type { PreparedSafeJob } from "../internal/types";
import type { MiningResult, SafeJobInput } from "../types";

import { SAFE_SETUP_ABI } from "../constants";
import { addressFromHash, countLeadingZeroNibbles, ensureAddress } from "../internal/address";
import { assert } from "../internal/assert";
import { hexToBytes, normalizeHex } from "../internal/hex";

export function encodeSafeInitializer(input: SafeJobInput): Hex {
  return encodeFunctionData({
    abi: SAFE_SETUP_ABI,
    functionName: "setup",
    args: [
      input.owners.map((owner) => ensureAddress(owner, "Safe owner")),
      input.threshold,
      ensureAddress(input.to, "Safe target"),
      normalizeHex(input.data, "Safe data"),
      ensureAddress(input.fallbackHandler, "Safe fallback handler"),
      ensureAddress(input.paymentToken, "Safe payment token"),
      input.payment,
      ensureAddress(input.paymentReceiver, "Safe payment receiver"),
    ],
  });
}

export function prepareSafeJob(input: SafeJobInput): PreparedSafeJob {
  const initializer = encodeSafeInitializer(input);
  const initializerHash = keccak256(initializer);
  const factory = ensureAddress(input.factory, "Safe factory");
  const proxyCreationCodeHash = normalizeHex(input.proxyCreationCodeHash, "Safe proxy creation code hash");
  assert(hexToBytes(proxyCreationCodeHash).length === 32, "Safe proxy creation code hash must be 32 bytes");

  return {
    protocol: "safe",
    startNonce: input.startNonce ?? 0n,
    initializerHash,
    initializerHashBytes: hexToBytes(initializerHash),
    factory,
    factoryBytes: hexToBytes(factory),
    proxyCreationCodeHash,
    proxyCreationCodeHashBytes: hexToBytes(proxyCreationCodeHash),
  };
}

export function computeSafeSalt(initializerHash: Hex, nonce: bigint): Hex {
  return keccak256(concat([initializerHash, pad(toHex(nonce), { size: 32 })]));
}

export function deriveSafeResult(job: PreparedSafeJob, nonce: bigint, score: number): MiningResult {
  const salt = computeSafeSalt(job.initializerHash, nonce);
  const hash = keccak256(concat(["0xff", job.factory, salt, job.proxyCreationCodeHash]));
  const address = getAddress(addressFromHash(hash));

  return {
    nonce,
    salt,
    address,
    score,
    leadingZeroNibbles: countLeadingZeroNibbles(address),
  };
}

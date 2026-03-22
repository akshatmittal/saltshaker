import { concat, encodeFunctionData, getAddress, keccak256, pad, toHex, type Hex } from "viem";

import {
  DEFAULT_SAFE_FACTORY,
  DEFAULT_SAFE_FALLBACK_HANDLER,
  DEFAULT_SAFE_PROXY_CREATION_CODE_HASH,
  SAFE_SETUP_ABI,
  ZERO_ADDRESS,
} from "../constants";
import type { MiningCandidate, PreparedSafeJob, SafeJobInput } from "../types";
import { addressFromHash, countLeadingZeroNibbles, ensureAddress, hexToBytes, normalizeHex } from "../utils";

export function encodeSafeInitializer(input: SafeJobInput): Hex {
  return encodeFunctionData({
    abi: SAFE_SETUP_ABI,
    functionName: "setup",
    args: [
      input.owners.map((owner) => ensureAddress(owner, "Safe owner")),
      input.threshold,
      input.to ?? ZERO_ADDRESS,
      input.data ?? "0x",
      input.fallbackHandler ?? DEFAULT_SAFE_FALLBACK_HANDLER,
      input.paymentToken ?? ZERO_ADDRESS,
      input.payment ?? 0n,
      input.paymentReceiver ?? ZERO_ADDRESS,
    ],
  });
}

export function prepareSafeJob(input: SafeJobInput): PreparedSafeJob {
  const initializer = encodeSafeInitializer(input);
  const initializerHash = keccak256(initializer);
  const factory = ensureAddress(input.factory ?? DEFAULT_SAFE_FACTORY, "Safe factory");
  const proxyCreationCodeHash = normalizeHex(
    input.proxyCreationCodeHash ?? DEFAULT_SAFE_PROXY_CREATION_CODE_HASH,
    "Safe proxy creation code hash",
  );

  return {
    protocol: "safe",
    startNonce: input.startNonce ?? 0n,
    initializer,
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

export function deriveSafeCandidate(job: PreparedSafeJob, nonce: bigint): MiningCandidate {
  const salt = computeSafeSalt(job.initializerHash, nonce);
  const hash = keccak256(concat(["0xff", job.factory, salt, job.proxyCreationCodeHash]));
  const address = getAddress(addressFromHash(hash));

  return {
    protocol: "safe",
    nonce,
    salt,
    address,
    leadingZeroNibbles: countLeadingZeroNibbles(address),
  };
}

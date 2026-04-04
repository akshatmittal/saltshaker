import { concat, getAddress, keccak256 } from "viem";

import type { PreparedCreate2Job } from "../internal/types";
import type { Create2JobInput, MiningResult } from "../types";

import { FIXED_SALT_PREFIX_BYTES } from "../constants";
import { addressFromHash, countLeadingZeroNibbles, ensureAddress } from "../internal/address";
import { assert } from "../internal/assert";
import { bytesToHex, hexToBytes, normalizeHex } from "../internal/hex";
import { writeBigEndianNonce } from "../internal/words";

export function prepareCreate2Job(input: Create2JobInput): PreparedCreate2Job {
  const deployer = ensureAddress(input.deployer, "CREATE2 deployer");
  const fixedSaltPrefix = normalizeHex(input.fixedSaltPrefix, "CREATE2 fixed salt prefix");
  const fixedSaltPrefixBytes = hexToBytes(fixedSaltPrefix);
  assert(
    fixedSaltPrefixBytes.length === FIXED_SALT_PREFIX_BYTES,
    `CREATE2 fixed salt prefix must be exactly ${FIXED_SALT_PREFIX_BYTES} bytes`,
  );

  const initCodeHash =
    input.initCodeHash !== undefined
      ? normalizeHex(input.initCodeHash, "CREATE2 init code hash")
      : input.initCode !== undefined
        ? keccak256(normalizeHex(input.initCode, "CREATE2 init code"))
        : null;

  assert(initCodeHash !== null, "CREATE2 job requires either initCode or initCodeHash");
  assert(hexToBytes(initCodeHash).length === 32, "CREATE2 init code hash must be 32 bytes");

  return {
    protocol: "create2",
    startNonce: input.startNonce ?? 0n,
    deployer,
    deployerBytes: hexToBytes(deployer),
    fixedSaltPrefixBytes,
    initCodeHash,
    initCodeHashBytes: hexToBytes(initCodeHash),
  };
}

export function deriveCreate2Result(job: PreparedCreate2Job, nonce: bigint, score: number): MiningResult {
  const saltBytes = new Uint8Array(32);
  saltBytes.set(job.fixedSaltPrefixBytes, 0);
  writeBigEndianNonce(saltBytes, FIXED_SALT_PREFIX_BYTES, nonce, 8);

  const salt = bytesToHex(saltBytes);
  const hash = keccak256(concat(["0xff", job.deployer, salt, job.initCodeHash]));
  const address = getAddress(addressFromHash(hash));

  return {
    nonce,
    salt,
    address,
    score,
    leadingZeroNibbles: countLeadingZeroNibbles(address),
  };
}

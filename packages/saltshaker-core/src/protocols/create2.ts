import { concat, getAddress, keccak256, type Address, type Hex } from "viem";

import { FIXED_SALT_PREFIX_BYTES } from "../constants";
import type { Create2JobInput, MiningCandidate, PreparedCreate2Job } from "../types";
import {
  addressFromHash,
  assert,
  bytesToHex,
  countLeadingZeroNibbles,
  ensureAddress,
  hexToBytes,
  normalizeHex,
  writeBigEndianNonce,
} from "../utils";

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
    fixedSaltPrefix,
    fixedSaltPrefixBytes,
    initCodeHash,
    initCodeHashBytes: hexToBytes(initCodeHash),
  };
}

export function deriveCreate2Candidate(job: PreparedCreate2Job, nonce: bigint): MiningCandidate {
  const saltBytes = new Uint8Array(32);
  saltBytes.set(job.fixedSaltPrefixBytes, 0);
  writeBigEndianNonce(saltBytes, FIXED_SALT_PREFIX_BYTES, nonce, 8);

  const salt = bytesToHex(saltBytes);
  const hash = keccak256(concat(["0xff", job.deployer, salt, job.initCodeHash]));
  const address = getAddress(addressFromHash(hash));

  return {
    protocol: "create2",
    nonce,
    salt,
    address,
    leadingZeroNibbles: countLeadingZeroNibbles(address),
  };
}

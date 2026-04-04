import { concat, encodeAbiParameters, getAddress, keccak256, type Hex } from "viem";

import type { PreparedCreateXJob } from "../internal/types";
import type { CreateXJobInput, MiningResult } from "../types";

import { CREATE3_PROXY_CHILD_CODE_HASH, FIXED_SALT_PREFIX_BYTES, ZERO_ADDRESS } from "../constants";
import { addressFromHash, countLeadingZeroNibbles, ensureAddress } from "../internal/address";
import { assert } from "../internal/assert";
import { bytesToHex, hexToBytes, normalizeHex } from "../internal/hex";
import { writeBigEndianNonce } from "../internal/words";

const CREATE_X_GUARD_HASH = 0;
const CREATE_X_GUARD_SENDER = 1;
const CREATE_X_GUARD_XCHAIN = 2;
const CREATE_X_GUARD_SENDER_XCHAIN = 3;

function prepareFixedSaltPrefix(fixedSaltPrefixInput: Hex | string, label: string): Uint8Array {
  const fixedSaltPrefix = normalizeHex(fixedSaltPrefixInput, label);
  const fixedSaltPrefixBytes = hexToBytes(fixedSaltPrefix);

  assert(
    fixedSaltPrefixBytes.length === FIXED_SALT_PREFIX_BYTES,
    `${label} must be exactly ${FIXED_SALT_PREFIX_BYTES} bytes`,
  );

  return fixedSaltPrefixBytes;
}

function prepareCaller(caller: string | undefined): { caller: `0x${string}` | null; callerBytes: Uint8Array } {
  if (caller === undefined) {
    return {
      caller: null,
      callerBytes: hexToBytes(ZERO_ADDRESS),
    };
  }

  const normalizedCaller = ensureAddress(caller, "CreateX caller");
  assert(normalizedCaller !== ZERO_ADDRESS, "CreateX caller must be a non-zero address");

  return {
    caller: normalizedCaller,
    callerBytes: hexToBytes(normalizedCaller),
  };
}

function prepareChainId(chainId: bigint | undefined): { chainId: bigint | null; chainIdBytes: Uint8Array } {
  if (chainId === undefined) {
    return {
      chainId: null,
      chainIdBytes: new Uint8Array(32),
    };
  }

  assert(chainId >= 0n, "CreateX chain ID must be a non-negative integer");
  const chainIdBytes = new Uint8Array(32);
  writeBigEndianNonce(chainIdBytes, 0, chainId, 32);

  return {
    chainId,
    chainIdBytes,
  };
}

function resolveCreateXGuardMode(
  fixedSaltPrefixBytes: Uint8Array,
  caller: `0x${string}` | null,
  chainId: bigint | null,
): number {
  const sender = getAddress(bytesToHex(fixedSaltPrefixBytes.slice(0, 20)));
  const redeployProtectionFlag = fixedSaltPrefixBytes[20] ?? 0;

  if (caller !== null && sender === caller) {
    if (redeployProtectionFlag === 0x01) {
      assert(chainId !== null, "CreateX chain ID is required when crosschain protection is enabled");
      return CREATE_X_GUARD_SENDER_XCHAIN;
    }

    if (redeployProtectionFlag === 0x00) {
      return CREATE_X_GUARD_SENDER;
    }

    throw new Error("CreateX salt flag must be 0x00 or 0x01 when the salt is caller-protected");
  }

  if (sender === ZERO_ADDRESS) {
    if (redeployProtectionFlag === 0x01) {
      assert(chainId !== null, "CreateX chain ID is required when crosschain protection is enabled");
      return CREATE_X_GUARD_XCHAIN;
    }

    if (redeployProtectionFlag === 0x00) {
      return CREATE_X_GUARD_HASH;
    }

    throw new Error("CreateX salt flag must be 0x00 or 0x01 when the salt starts with the zero address");
  }

  return CREATE_X_GUARD_HASH;
}

function buildCreateXSalt(fixedSaltPrefixBytes: Uint8Array, nonce: bigint): Hex {
  const saltBytes = new Uint8Array(32);
  saltBytes.set(fixedSaltPrefixBytes, 0);
  writeBigEndianNonce(saltBytes, FIXED_SALT_PREFIX_BYTES, nonce, 8);
  return bytesToHex(saltBytes);
}

function guardCreateXSalt(
  salt: Hex,
  guardMode: number,
  caller: `0x${string}` | null,
  chainId: bigint | null,
): Hex {
  if (guardMode === CREATE_X_GUARD_HASH) {
    return keccak256(salt);
  }

  if (guardMode === CREATE_X_GUARD_SENDER) {
    assert(caller !== null, "CreateX caller is required for caller-protected salts");
    return keccak256(
      encodeAbiParameters(
        [
          { type: "address" },
          { type: "bytes32" },
        ],
        [caller, salt],
      ),
    );
  }

  if (guardMode === CREATE_X_GUARD_XCHAIN) {
    assert(chainId !== null, "CreateX chain ID is required for crosschain-protected salts");
    return keccak256(
      encodeAbiParameters(
        [
          { type: "uint256" },
          { type: "bytes32" },
        ],
        [chainId, salt],
      ),
    );
  }

  assert(caller !== null, "CreateX caller is required for caller-protected salts");
  assert(chainId !== null, "CreateX chain ID is required for crosschain-protected salts");
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "uint256" },
        { type: "bytes32" },
      ],
      [caller, chainId, salt],
    ),
  );
}

function createResult(address: `0x${string}`, nonce: bigint, salt: Hex, score: number): MiningResult {
  return {
    nonce,
    salt,
    address,
    score,
    leadingZeroNibbles: countLeadingZeroNibbles(address),
  };
}

export function prepareCreateXJob(input: CreateXJobInput): PreparedCreateXJob {
  const factory = ensureAddress(input.factory, "CreateX factory");
  const fixedSaltPrefixBytes = prepareFixedSaltPrefix(input.fixedSaltPrefix, "CreateX fixed salt prefix");
  const { caller, callerBytes } = prepareCaller(input.caller);
  const { chainId, chainIdBytes } = prepareChainId(input.chainId);
  const guardMode = resolveCreateXGuardMode(fixedSaltPrefixBytes, caller, chainId);

  const initCodeHash =
    input.initCodeHash !== undefined
      ? normalizeHex(input.initCodeHash, "CreateX init code hash")
      : input.initCode !== undefined
        ? keccak256(normalizeHex(input.initCode, "CreateX init code"))
        : null;

  if (input.createOperation === "create2") {
    assert(initCodeHash !== null, "CreateX CREATE2 job requires either initCode or initCodeHash");
    assert(hexToBytes(initCodeHash).length === 32, "CreateX init code hash must be 32 bytes");
  }

  return {
    protocol: "createx",
    createOperation: input.createOperation,
    startNonce: input.startNonce ?? 0n,
    factory,
    factoryBytes: hexToBytes(factory),
    fixedSaltPrefixBytes,
    caller,
    callerBytes,
    chainId,
    chainIdBytes,
    guardMode,
    initCodeHash: (initCodeHash ?? CREATE3_PROXY_CHILD_CODE_HASH) as Hex,
    initCodeHashBytes: hexToBytes((initCodeHash ?? CREATE3_PROXY_CHILD_CODE_HASH) as Hex),
    proxyChildCodeHash: CREATE3_PROXY_CHILD_CODE_HASH,
    proxyChildCodeHashBytes: hexToBytes(CREATE3_PROXY_CHILD_CODE_HASH),
  };
}

export function deriveCreateXResult(job: PreparedCreateXJob, nonce: bigint, score: number): MiningResult {
  const salt = buildCreateXSalt(job.fixedSaltPrefixBytes, nonce);
  const guardedSalt = guardCreateXSalt(salt, job.guardMode, job.caller, job.chainId);
  const hash =
    job.createOperation === "create2"
      ? keccak256(concat(["0xff", job.factory, guardedSalt, job.initCodeHash]))
      : keccak256(
          concat([
            "0xd6",
            "0x94",
            getAddress(addressFromHash(keccak256(concat(["0xff", job.factory, guardedSalt, job.proxyChildCodeHash])))),
            "0x01",
          ]),
        );
  const address = getAddress(addressFromHash(hash));
  return createResult(address, nonce, salt, score);
}

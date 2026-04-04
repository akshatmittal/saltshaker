import { concat, encodeAbiParameters, getAddress, keccak256 } from "viem";
import { describe, expect, it } from "vitest";

import { CREATE3_PROXY_CHILD_CODE_HASH } from "../constants";
import { addressFromHash } from "../internal/address";
import { deriveCreateXResult, prepareCreateXJob } from "./createx";

const FACTORY = "0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed" as const;
const CALLER = "0x88c6C46EBf353A52Bdbab708c23D0c81dAA8134A" as const;
const INIT_CODE_HASH = "0x6e1cce4955d4b57d9569397925551f2fb36c34f1cfe0f2e8c0c727c44bd08b90" as const;

describe("CreateX protocols", () => {
  it("derives caller-protected CreateX CREATE2 addresses", () => {
    const job = prepareCreateXJob({
      protocol: "createx",
      createOperation: "create2",
      factory: FACTORY,
      fixedSaltPrefix: `0x${CALLER.slice(2)}00a1b2c3`,
      caller: CALLER,
      initCodeHash: INIT_CODE_HASH,
    });

    const result = deriveCreateXResult(job, 0x0102030405060708n, 123);
    const guardedSalt = keccak256(
      encodeAbiParameters([{ type: "address" }, { type: "bytes32" }], [CALLER, result.salt]),
    );
    const expectedAddress = getAddress(
      addressFromHash(keccak256(concat(["0xff", FACTORY, guardedSalt, INIT_CODE_HASH]))),
    );

    expect(result.salt).toBe(`0x${CALLER.slice(2).toLowerCase()}00a1b2c30102030405060708`);
    expect(result.address).toBe(expectedAddress);
    expect(result.score).toBe(123);
  });

  it("derives caller and crosschain protected CreateX CREATE3 addresses", () => {
    const chainId = 8453n;
    const job = prepareCreateXJob({
      protocol: "createx",
      createOperation: "create3",
      factory: FACTORY,
      fixedSaltPrefix: `0x${CALLER.slice(2)}01a1b2c3`,
      caller: CALLER,
      chainId,
    });

    const result = deriveCreateXResult(job, 0x1112131415161718n, 99);
    const guardedSalt = keccak256(
      encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }, { type: "bytes32" }],
        [CALLER, chainId, result.salt],
      ),
    );
    const proxy = getAddress(
      addressFromHash(keccak256(concat(["0xff", FACTORY, guardedSalt, CREATE3_PROXY_CHILD_CODE_HASH]))),
    );
    const expectedAddress = getAddress(addressFromHash(keccak256(concat(["0xd6", "0x94", proxy, "0x01"]))));

    expect(result.salt).toBe(`0x${CALLER.slice(2).toLowerCase()}01a1b2c31112131415161718`);
    expect(result.address).toBe(expectedAddress);
    expect(result.score).toBe(99);
  });

  it("hashes non-protected CreateX salts before CREATE2 address derivation", () => {
    const job = prepareCreateXJob({
      protocol: "createx",
      createOperation: "create2",
      factory: FACTORY,
      fixedSaltPrefix: "0x1234567890abcdef1234567890abcdef1234567899aabbcc",
      initCodeHash: INIT_CODE_HASH,
    });

    const result = deriveCreateXResult(job, 0x0102030405060708n, 1);
    const guardedSalt = keccak256(result.salt);
    const expectedAddress = getAddress(
      addressFromHash(keccak256(concat(["0xff", FACTORY, guardedSalt, INIT_CODE_HASH]))),
    );

    expect(result.address).toBe(expectedAddress);
  });

  it("rejects unspecified protection flags for caller or zero-address guarded salts", () => {
    expect(() =>
      prepareCreateXJob({
        protocol: "createx",
        createOperation: "create2",
        factory: FACTORY,
        fixedSaltPrefix: `0x${CALLER.slice(2)}02a1b2c3`,
        caller: CALLER,
        initCodeHash: INIT_CODE_HASH,
      }),
    ).toThrow("CreateX salt flag must be 0x00 or 0x01");

    expect(() =>
      prepareCreateXJob({
        protocol: "createx",
        createOperation: "create3",
        factory: FACTORY,
        fixedSaltPrefix: "0x000000000000000000000000000000000000000002a1b2c3",
      }),
    ).toThrow("CreateX salt flag must be 0x00 or 0x01");
  });
});

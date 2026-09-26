import { keccak256, zeroAddress } from "viem";
import { describe, expect, it } from "vitest";

import type { SafeJobInput } from "../types";

import { computeSafeSalt, deriveSafeResult, encodeSafeInitializer, prepareSafeJob } from "./safe";

const input: SafeJobInput = {
  protocol: "safe",
  owners: ["0x33333333Bd7045F1A601A1E289D7AB21036fB5EF"],
  threshold: 1n,
  to: zeroAddress,
  data: "0x",
  fallbackHandler: "0x3EfCBb83A4A7AfcB4F68D501E2c2203a38be77f4",
  paymentToken: zeroAddress,
  payment: 0n,
  paymentReceiver: zeroAddress,
  factory: "0x14F2982D601c9458F93bd70B218933A6f8165e7b",
  proxyCreationCodeHash: "0x9dd695a8d96e2c0f6ede304e13cc2efe754fa353b7389a23340c9317113bc975",
};
const nonce = 338113103878n;

describe("Safe protocol", () => {
  // Mainnet tx 0xc1dd437d103e230d1cbe24b31f75f4473253adc7b46249a11536a7d844eb16fd.
  it("reproduces a deployed v1.5.0 Safe", () => {
    const hash = keccak256(encodeSafeInitializer(input));
    expect(hash).toBe("0x1b6889a1fc267380ed066616a61813ff6a70e9e90c7596fe485fc85c174f2f3f");
    expect(computeSafeSalt(hash, nonce)).toBe("0xf9210490bd614f02ad264bc1cba3bad196324debe8824da51c261eaa9e019a78");
    const result = deriveSafeResult(prepareSafeJob(input), nonce, 9);
    expect(result.address).toBe("0x311311311A0F18744B2489b529E03fE0201E6363");
    expect(result.nonce).toBe(nonce);
  });

  // Independently computed with Foundry cast 1.7.1: calldata setup(...), keccak(initializer),
  // keccak(initializerHash ++ uint256(nonce)), keccak(0xff ++ factory ++ salt ++ proxyHash).
  it("reproduces the v1.4.1 SafeToL2Setup cast vector", () => {
    const job: SafeJobInput = {
      ...input,
      factory: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67",
      proxyCreationCodeHash: "0x76733d705f71b79841c0ee960a0ca880f779cde7ef446c989e6d23efc0a4adfb",
      fallbackHandler: "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99",
      to: "0xBD89A1CE4DDe368FFAB0eC35506eEcE0b1fFdc54",
      data: "0xfe51f64300000000000000000000000029fcb43b46531bca003ddc8fcb67ffe91900c762",
    };
    const hash = keccak256(encodeSafeInitializer(job));
    expect(hash).toBe("0xc95674047617bdbb30fa471ece32f25999abacfd7ed0238c2219a59bcdfc1073");
    expect(computeSafeSalt(hash, nonce)).toBe("0xa59cdf9a257c7af7228eba7ffdb78ee8fc349c3a3456187c8d9cabacbe571f15");
    expect(deriveSafeResult(prepareSafeJob(job), nonce, 0).address).toBe("0x3520dcab432AdE2e539a6d5dE2c513e9131AeAB2");
  });
});

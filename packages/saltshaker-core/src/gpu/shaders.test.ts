import { describe, expect, it } from "vitest";

import { getMiningShader } from "./shaders";

describe("getMiningShader", () => {
  it("assembles every protocol and matcher variant", () => {
    const variants = [
      ["create2", "prefix"],
      ["create2", "suffix"],
      ["create2", "contains"],
      ["create2", "leadingZeros"],
      ["safe", "prefix"],
      ["safe", "suffix"],
      ["safe", "contains"],
      ["safe", "leadingZeros"],
    ] as const;

    for (const [protocol, matcher] of variants) {
      const shader = getMiningShader(protocol, matcher);
      expect(shader).toContain("@compute");
      expect(shader).toContain("fn main");
    }
  });

  it("keeps protocol-specific address derivation isolated from the shared kernel", () => {
    const create2 = getMiningShader("create2", "prefix");
    const safe = getMiningShader("safe", "prefix");

    expect(create2).toContain("struct ProtocolData");
    expect(create2).toContain("salt_prefix");
    expect(create2).toContain("fn protocol_address");
    expect(safe).toContain("initializer_hash");
    expect(safe).toContain("proxy_code_hash");
    expect(safe).toContain("keccak256_64");
  });

  it("uses one shared compute kernel for all variants", () => {
    const create2 = getMiningShader("create2", "prefix");
    const safe = getMiningShader("safe", "leadingZeros");

    expect(create2.match(/@compute/g)).toHaveLength(1);
    expect(create2.match(/fn main/g)).toHaveLength(1);
    expect(create2).toContain("constants.protocol");
    expect(create2).toContain("constants.matcher");
    expect(safe).toContain("constants.protocol");
    expect(safe).toContain("constants.matcher");
  });

  it("keeps matcher-specific data layouts intact", () => {
    const prefix = getMiningShader("create2", "prefix");
    const leadingZeros = getMiningShader("create2", "leadingZeros");

    expect(prefix).toContain("value_len_nibbles");
    expect(prefix).toContain("matcher_pattern_nibble");
    expect(leadingZeros).toContain("min_zero_nibbles");
    expect(leadingZeros).toContain("matcher_leading_zero_nibbles");
  });
});

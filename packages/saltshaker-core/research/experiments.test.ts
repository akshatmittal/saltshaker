import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { experimentCore } from "./experiments";

const core = readFileSync(new URL("../src/gpu/shaders/common/core.wgsl", import.meta.url), "utf8");

describe("research source transforms", () => {
  it("preserves all 24 round constants in order for every loop factor", () => {
    const roundBody = core.slice(core.indexOf("fn keccakf("), core.indexOf("fn keccak256_64("));
    const constants = roundBody.match(/make_u64\(0x[0-9a-f]+u, 0x[0-9a-f]+u\)/g)!;
    expect(constants).toHaveLength(24);
    expect(experimentCore(core)).toBe(core);
    expect(experimentCore(core, { roundsPerIteration: 24 })).toBe(core);
    for (const factor of [1, 2, 3, 4, 6, 8, 12]) {
      const transformed = experimentCore(core, { roundsPerIteration: factor });
      const body = transformed.slice(transformed.indexOf("fn keccakf("), transformed.indexOf("fn keccak256_64("));
      expect(body.match(/make_u64\(0x[0-9a-f]+u, 0x[0-9a-f]+u\)/g)).toEqual(constants);
      expect(body).toContain(`round += ${factor}u`);
      expect(body.match(/theta\(a\)/g)).toHaveLength(factor);
      expect(body).toContain(`round_constants[round + ${factor - 1}u]`);
    }
  });

  it("rejects loop factors that skip rounds or never terminate", () => {
    for (const factor of [0, -1, 5, 25, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => experimentCore(core, { roundsPerIteration: factor })).toThrow("positive divisor of 24");
    }
    expect(() => experimentCore("fn keccakf() {}", { roundsPerIteration: 2 })).toThrow("original unrolled core");
  });

  it("can remove zeroing without also unrolling input or output", () => {
    const source = `    for (var i = 0u; i < 25u; i++) {
        state[i] = make_u64(0u, 0u);
    }
    for (var i = 0u; i < 4u; i++) {
        state[i] = make_u64(input[i * 2u], input[i * 2u + 1u]);
    }`;
    const zeroOnly = experimentCore(source, { implicitZeroInit: true });
    expect(zeroOnly).not.toContain("i < 25u");
    expect(zeroOnly).toContain("i < 4u");
    const staticIO = experimentCore(source, { staticIO: true });
    expect(staticIO).not.toContain("for (");
    expect(staticIO.match(/state\[/g)).toHaveLength(4);
    expect(staticIO).toContain("state[0u] = make_u64(input[0u * 2u], input[0u * 2u + 1u]);");
    expect(staticIO).toContain("state[3u] = make_u64(input[3u * 2u], input[3u * 2u + 1u]);");
  });

  it("can restrict implicit zero initialization to the CREATE2 helper", () => {
    const helper = `fn keccak256_85_address() {
    var state: array<xu64, 25>;
    for (var i = 0u; i < 25u; i++) {
        state[i] = make_u64(0u, 0u);
    }
}`;
    const other = helper.replace("keccak256_85_address", "keccak256_64");
    const result = experimentCore(helper + "\n" + other, { create2ZeroInit: true });
    expect(result).toBe(`fn keccak256_85_address() {
    var state: array<xu64, 25>;
}\n${other}`);
  });
});

/// <reference path="../wgsl.d.ts" />

import addressShader from "./shaders/common/address.wgsl";
import keccakShader from "./shaders/common/keccak.wgsl";
import utilsShader from "./shaders/common/utils.wgsl";
import create2EntrypointShader from "./shaders/entrypoints/create2.wgsl";
import safeEntrypointShader from "./shaders/entrypoints/safe.wgsl";
import containsMatcherShader from "./shaders/matchers/contains.wgsl";
import leadingZerosMatcherShader from "./shaders/matchers/leading-zeros.wgsl";
import prefixMatcherShader from "./shaders/matchers/prefix.wgsl";
import suffixMatcherShader from "./shaders/matchers/suffix.wgsl";

import type { MatcherKind } from "../types";

const MATCHER_KINDS = ["prefix", "suffix", "contains", "leadingZeros"] as const satisfies readonly MatcherKind[];

const matcherShaders: Record<MatcherKind, string> = {
  prefix: prefixMatcherShader,
  suffix: suffixMatcherShader,
  contains: containsMatcherShader,
  leadingZeros: leadingZerosMatcherShader,
};

const COMMON_SHADER = [utilsShader, keccakShader, addressShader].join("\n");

function assembleProtocolShaders(entrypointShader: string): Record<MatcherKind, string> {
  return Object.fromEntries(
    MATCHER_KINDS.map((matcherKind) => [
      matcherKind,
      [COMMON_SHADER, matcherShaders[matcherKind], entrypointShader].join("\n"),
    ]),
  ) as Record<MatcherKind, string>;
}

const create2Shaders = assembleProtocolShaders(create2EntrypointShader);
const safeShaders = assembleProtocolShaders(safeEntrypointShader);

export function getMiningShader(protocol: "create2" | "safe", matcherKind: MatcherKind): string {
  return protocol === "create2" ? create2Shaders[matcherKind] : safeShaders[matcherKind];
}

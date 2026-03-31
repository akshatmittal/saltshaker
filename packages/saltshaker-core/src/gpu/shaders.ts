/// <reference path="../wgsl.d.ts" />

import coreShader from "./shaders/common/core.wgsl";
import kernelShader from "./shaders/common/kernel.wgsl";
import containsMatcherShader from "./shaders/matchers/contains.wgsl";
import leadingZerosMatcherShader from "./shaders/matchers/leading-zeros.wgsl";
import patternMatcherShader from "./shaders/matchers/pattern-common.wgsl";
import prefixMatcherShader from "./shaders/matchers/prefix.wgsl";
import suffixMatcherShader from "./shaders/matchers/suffix.wgsl";
import create2ProtocolShader from "./shaders/protocols/create2.wgsl";
import safeProtocolShader from "./shaders/protocols/safe.wgsl";

import type { MatcherKind } from "../types";

type MiningProtocol = "create2" | "safe";

const PROTOCOL_SHADERS: Record<MiningProtocol, string> = {
  create2: create2ProtocolShader,
  safe: safeProtocolShader,
};

const MATCHER_SHADERS: Record<MatcherKind, string> = {
  prefix: [patternMatcherShader, prefixMatcherShader].join("\n"),
  suffix: [patternMatcherShader, suffixMatcherShader].join("\n"),
  contains: [patternMatcherShader, containsMatcherShader].join("\n"),
  leadingZeros: leadingZerosMatcherShader,
};

function assembleShader(protocol: MiningProtocol, matcherKind: MatcherKind): string {
  return [coreShader, MATCHER_SHADERS[matcherKind], PROTOCOL_SHADERS[protocol], kernelShader].join("\n");
}

const create2Shaders = {
  prefix: assembleShader("create2", "prefix"),
  suffix: assembleShader("create2", "suffix"),
  contains: assembleShader("create2", "contains"),
  leadingZeros: assembleShader("create2", "leadingZeros"),
} as const satisfies Record<MatcherKind, string>;

const safeShaders = {
  prefix: assembleShader("safe", "prefix"),
  suffix: assembleShader("safe", "suffix"),
  contains: assembleShader("safe", "contains"),
  leadingZeros: assembleShader("safe", "leadingZeros"),
} as const satisfies Record<MatcherKind, string>;

export function getMiningShader(protocol: MiningProtocol, matcherKind: MatcherKind): string {
  return protocol === "create2" ? create2Shaders[matcherKind] : safeShaders[matcherKind];
}

/// <reference path="../wgsl.d.ts" />

import addressShader from "./shaders/common/address.wgsl";
import keccakShader from "./shaders/common/keccak.wgsl";
import utilsShader from "./shaders/common/utils.wgsl";
import create2EntrypointShader from "./shaders/entrypoints/create2.wgsl";
import safeEntrypointShader from "./shaders/entrypoints/safe.wgsl";
import containsMatcherShader from "./shaders/matchers/contains.wgsl";
import leadingZerosMatcherShader from "./shaders/matchers/leading-zeros.wgsl";
import noneMatcherShader from "./shaders/matchers/none.wgsl";
import prefixMatcherShader from "./shaders/matchers/prefix.wgsl";
import suffixMatcherShader from "./shaders/matchers/suffix.wgsl";

import type { MatcherKind } from "../types";

const matcherShaders: Record<MatcherKind, string> = {
  none: noneMatcherShader,
  prefix: prefixMatcherShader,
  suffix: suffixMatcherShader,
  contains: containsMatcherShader,
  leadingZeros: leadingZerosMatcherShader,
};

const commonShaders = [utilsShader, keccakShader, addressShader];

const create2Shaders: Record<MatcherKind, string> = {
  none: [...commonShaders, matcherShaders.none, create2EntrypointShader].join("\n"),
  prefix: [...commonShaders, matcherShaders.prefix, create2EntrypointShader].join("\n"),
  suffix: [...commonShaders, matcherShaders.suffix, create2EntrypointShader].join("\n"),
  contains: [...commonShaders, matcherShaders.contains, create2EntrypointShader].join("\n"),
  leadingZeros: [...commonShaders, matcherShaders.leadingZeros, create2EntrypointShader].join("\n"),
};

const safeShaders: Record<MatcherKind, string> = {
  none: [...commonShaders, matcherShaders.none, safeEntrypointShader].join("\n"),
  prefix: [...commonShaders, matcherShaders.prefix, safeEntrypointShader].join("\n"),
  suffix: [...commonShaders, matcherShaders.suffix, safeEntrypointShader].join("\n"),
  contains: [...commonShaders, matcherShaders.contains, safeEntrypointShader].join("\n"),
  leadingZeros: [...commonShaders, matcherShaders.leadingZeros, safeEntrypointShader].join("\n"),
};

export function getMiningShader(protocol: "create2" | "safe", matcherKind: MatcherKind): string {
  return protocol === "create2" ? create2Shaders[matcherKind] : safeShaders[matcherKind];
}

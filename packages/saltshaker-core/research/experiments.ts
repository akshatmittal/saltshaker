// Research-only source transforms. Production never imports this module.
export interface Experiment {
  roundsPerIteration?: number;
  staticIO?: boolean;
}

export function experimentCore(source: string, experiment: Experiment = {}): string {
  let result = source;
  if (experiment.staticIO) {
    // WGSL function variables are zero-initialized. Eliminate redundant clearing
    // and expose constant indices in fixed-size absorption/squeeze operations.
    result = result.replace(
      /    for \(var i = 0u; i < 25u; i\+\+\) \{\n        state\[i\] = make_u64\(0u, 0u\);\n    \}\n/g,
      "",
    );
    result = result.replace(
      /    for \(var i = 0u; i < (\d+)u; i\+\+\) \{\n([^{}]+)    \}/g,
      (_, count: string, body: string) =>
        Array.from({ length: Number(count) }, (_, i) => body.replace(/\bi\b/g, `${i}u`).replace(/^    /gm, ""))
          .join("")
          .trimEnd(),
    );
  }
  const factor = experiment.roundsPerIteration;
  if (factor === undefined || factor === 24) return result;
  if (!Number.isInteger(factor) || factor < 1 || 24 % factor !== 0) {
    throw new Error("roundsPerIteration must be a positive divisor of 24");
  }
  const pattern = /fn keccakf\(a: ptr<function, array<xu64, 25>>\) \{\n([\s\S]*?)\n\}/;
  const original = result.match(pattern);
  const constants = original?.[1]?.match(/make_u64\(0x[0-9a-f]+u, 0x[0-9a-f]+u\)/g);
  if (constants?.length !== 24) throw new Error("Round experiment requires the original unrolled core");
  const rounds = Array.from(
    { length: factor },
    (_, i) => `        theta(a); rhoPi(a); chi(a); iota(a, round_constants[round + ${i}u]);`,
  ).join("\n");
  return result.replace(
    pattern,
    `fn keccakf(a: ptr<function, array<xu64, 25>>) {
    let round_constants = array<xu64, 24>(
        ${constants.join(",\n        ")}
    );
    for (var round = 0u; round < 24u; round += ${factor}u) {
${rounds}
    }
}`,
  );
}

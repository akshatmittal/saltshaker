import type { MiningJob, MiningResult } from "../types";
import type { PreparedJob } from "./types";

import { deriveCreate2Result, prepareCreate2Job } from "../protocols/create2";
import { deriveSafeResult, prepareSafeJob } from "../protocols/safe";

export function prepareJob(job: MiningJob): PreparedJob {
  return job.protocol === "create2" ? prepareCreate2Job(job) : prepareSafeJob(job);
}

export function deriveResult(job: PreparedJob, nonce: bigint, score: number): MiningResult {
  return job.protocol === "create2" ? deriveCreate2Result(job, nonce, score) : deriveSafeResult(job, nonce, score);
}

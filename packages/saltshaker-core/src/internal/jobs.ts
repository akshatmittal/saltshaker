import type { MiningJob, MiningResult } from "../types";
import type { PreparedJob } from "./types";

import { deriveCreate2Result, prepareCreate2Job } from "../protocols/create2";
import { deriveCreateXResult, prepareCreateXJob } from "../protocols/createx";
import { deriveSafeResult, prepareSafeJob } from "../protocols/safe";

export function prepareJob(job: MiningJob): PreparedJob {
  switch (job.protocol) {
    case "create2":
      return prepareCreate2Job(job);
    case "safe":
      return prepareSafeJob(job);
    case "createx":
      return prepareCreateXJob(job);
  }
}

export function deriveResult(job: PreparedJob, nonce: bigint, score: number): MiningResult {
  switch (job.protocol) {
    case "create2":
      return deriveCreate2Result(job, nonce, score);
    case "safe":
      return deriveSafeResult(job, nonce, score);
    case "createx":
      return deriveCreateXResult(job, nonce, score);
  }
}

import type { MiningCandidate, MiningJob, PreparedMiningJob } from "./types";
import { deriveCreate2Candidate, prepareCreate2Job } from "./protocols/create2";
import { deriveSafeCandidate, prepareSafeJob } from "./protocols/safe";

export function prepareJob(job: MiningJob): PreparedMiningJob {
  return job.protocol === "create2" ? prepareCreate2Job(job) : prepareSafeJob(job);
}

export function deriveCandidate(job: PreparedMiningJob, nonce: bigint, score: number): MiningCandidate {
  return job.protocol === "create2" ? deriveCreate2Candidate(job, nonce, score) : deriveSafeCandidate(job, nonce, score);
}

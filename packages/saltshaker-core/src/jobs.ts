import type { MiningCandidate, MiningJob, PreparedMiningJob } from "./types";
import { prepareCreate2Job } from "./protocols/create2";
import { deriveSafeCandidate, prepareSafeJob } from "./protocols/safe";
import { deriveCreate2Candidate } from "./protocols/create2";

export function prepareJob(job: MiningJob): PreparedMiningJob {
  return job.protocol === "create2" ? prepareCreate2Job(job) : prepareSafeJob(job);
}

export function deriveCandidate(job: PreparedMiningJob, nonce: bigint): MiningCandidate {
  return job.protocol === "create2" ? deriveCreate2Candidate(job, nonce) : deriveSafeCandidate(job, nonce);
}

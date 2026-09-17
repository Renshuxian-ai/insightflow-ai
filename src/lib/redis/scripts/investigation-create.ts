import "server-only";

import { getRedisClient } from "@/lib/redis/client";

import { parseAtomicMutationStatus } from "./result";

const CREATE_INVESTIGATION_SCRIPT = `
local sessionRaw = redis.call('GET', KEYS[4])
if not sessionRaw then return 'expired' end

local sessionOk, session = pcall(cjson.decode, sessionRaw)
if not sessionOk or session.runtimeSessionId ~= ARGV[2] or session.datasetIdentity ~= ARGV[3] then
  return 'conflict'
end

local now = redis.call('TIME')
if tonumber(ARGV[7]) <= tonumber(now[1]) then return 'expired' end

local existingRaw = redis.call('GET', KEYS[1])
if existingRaw then
  local existingOk, existing = pcall(cjson.decode, existingRaw)
  if not existingOk or existing.id ~= ARGV[4] or existing.datasetIdentity ~= ARGV[3]
    or existing.signalFingerprint ~= ARGV[5]
    or (existing.runtimeSessionId and existing.runtimeSessionId ~= ARGV[2]) then
    return 'conflict'
  end

  local pointer = redis.call('GET', KEYS[3])
  if pointer ~= ARGV[4] then return 'conflict' end
  return 'existing'
end

local pointer = redis.call('GET', KEYS[3])
if pointer and pointer ~= ARGV[4] and ARGV[6] ~= '1' then
  return 'conflict'
end

redis.call('SET', KEYS[1], ARGV[1], 'EXAT', ARGV[7])
redis.call('ZADD', KEYS[2], ARGV[8], ARGV[4])
redis.call('EXPIREAT', KEYS[2], ARGV[7])
redis.call('SET', KEYS[3], ARGV[4], 'EXAT', ARGV[7])
return 'created'
`;

export async function createInvestigationAtomically(input: {
  keys: [string, string, string, string];
  record: unknown;
  runtimeSessionId: string;
  datasetIdentity: string;
  investigationId: string;
  signalFingerprint: string;
  replaceFingerprintPointer: boolean;
  expiresAt: number;
  score: number;
}) {
  const result = await getRedisClient().eval<string[], string>(
    CREATE_INVESTIGATION_SCRIPT,
    input.keys,
    [
      JSON.stringify(input.record),
      input.runtimeSessionId,
      input.datasetIdentity,
      input.investigationId,
      input.signalFingerprint,
      input.replaceFingerprintPointer ? "1" : "0",
      String(input.expiresAt),
      String(input.score),
    ],
  );

  return parseAtomicMutationStatus(result);
}

import "server-only";

import { getRedisClient } from "@/lib/redis/client";

import { parseAtomicMutationStatus } from "./result";

const UPDATE_INVESTIGATION_SCRIPT = `
local sessionRaw = redis.call('GET', KEYS[3])
if not sessionRaw then return 'expired' end

local sessionOk, session = pcall(cjson.decode, sessionRaw)
if not sessionOk or session.runtimeSessionId ~= ARGV[2] or session.datasetIdentity ~= ARGV[3] then
  return 'conflict'
end

local now = redis.call('TIME')
if tonumber(ARGV[8]) <= tonumber(now[1]) then return 'expired' end

local currentRaw = redis.call('GET', KEYS[1])
if not currentRaw then return 'not-found' end

local currentOk, current = pcall(cjson.decode, currentRaw)
if not currentOk or current.id ~= ARGV[4] or current.datasetIdentity ~= ARGV[3]
  or (current.runtimeSessionId and current.runtimeSessionId ~= ARGV[2]) then
  return 'conflict'
end

local currentVersion = tonumber(current.version) or 1
if currentVersion ~= tonumber(ARGV[5]) or current.status ~= ARGV[6] then
  return 'conflict'
end

local updatedOk, updated = pcall(cjson.decode, ARGV[1])
if not updatedOk or updated.id ~= ARGV[4] or updated.datasetIdentity ~= ARGV[3]
  or updated.runtimeSessionId ~= ARGV[2]
  or tonumber(updated.version) ~= currentVersion + 1
  or updated.status ~= ARGV[7] then
  return 'conflict'
end

redis.call('SET', KEYS[1], ARGV[1], 'EXAT', ARGV[8])
redis.call('ZADD', KEYS[2], ARGV[9], ARGV[4])
redis.call('EXPIREAT', KEYS[2], ARGV[8])
return 'ok'
`;

export async function updateInvestigationAtomically(input: {
  keys: [string, string, string];
  updatedRecord: unknown;
  runtimeSessionId: string;
  datasetIdentity: string;
  investigationId: string;
  expectedVersion: number;
  expectedStatus: string;
  nextStatus: string;
  expiresAt: number;
  score: number;
}) {
  const result = await getRedisClient().eval<string[], string>(
    UPDATE_INVESTIGATION_SCRIPT,
    input.keys,
    [
      JSON.stringify(input.updatedRecord),
      input.runtimeSessionId,
      input.datasetIdentity,
      input.investigationId,
      String(input.expectedVersion),
      input.expectedStatus,
      input.nextStatus,
      String(input.expiresAt),
      String(input.score),
    ],
  );

  return parseAtomicMutationStatus(result);
}

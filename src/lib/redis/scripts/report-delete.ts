import "server-only";

import { getRedisClient } from "@/lib/redis/client";

import { parseAtomicMutationStatus } from "./result";

const DELETE_REPORT_SCRIPT = `
local sessionRaw = redis.call('GET', KEYS[6])
if not sessionRaw then return 'expired' end

local sessionOk, session = pcall(cjson.decode, sessionRaw)
if not sessionOk or session.runtimeSessionId ~= ARGV[2] or session.datasetIdentity ~= ARGV[3] then
  return 'conflict'
end

local now = redis.call('TIME')
if tonumber(ARGV[7]) <= tonumber(now[1]) then return 'expired' end

local reportRaw = redis.call('GET', KEYS[1])
if not reportRaw then return 'not-found' end

local reportOk, report = pcall(cjson.decode, reportRaw)
if not reportOk or report.id ~= ARGV[4] or report.datasetIdentity ~= ARGV[3]
  or report.investigationCaseId ~= ARGV[5] then
  return 'conflict'
end

local pointer = redis.call('GET', KEYS[3])
if pointer and pointer ~= ARGV[4] then return 'conflict' end

local investigationRaw = redis.call('GET', KEYS[4])
if investigationRaw then
  local investigationOk, investigation = pcall(cjson.decode, investigationRaw)
  if not investigationOk then return 'conflict' end
  local currentVersion = tonumber(investigation.version) or 1
  if investigation.id ~= ARGV[5]
    or investigation.datasetIdentity ~= ARGV[3]
    or (investigation.runtimeSessionId and investigation.runtimeSessionId ~= ARGV[2])
    or currentVersion ~= tonumber(ARGV[6])
    or investigation.status ~= 'Validated'
    or investigation.reportId ~= ARGV[4] then
    return 'conflict'
  end

  local updatedOk, updated = pcall(cjson.decode, ARGV[1])
  if not updatedOk or updated.id ~= ARGV[5] or updated.datasetIdentity ~= ARGV[3]
    or updated.runtimeSessionId ~= ARGV[2]
    or tonumber(updated.version) ~= currentVersion + 1
    or updated.status ~= 'Validation ready'
    or (updated.reportId and updated.reportId ~= cjson.null) then
    return 'conflict'
  end

  redis.call('SET', KEYS[4], ARGV[1], 'EXAT', ARGV[7])
  redis.call('ZADD', KEYS[5], ARGV[8], ARGV[5])
  redis.call('EXPIREAT', KEYS[5], ARGV[7])
end

redis.call('DEL', KEYS[1])
redis.call('ZREM', KEYS[2], ARGV[4])
redis.call('DEL', KEYS[3])
return 'ok'
`;

export async function deleteReportAtomically(input: {
  keys: [string, string, string, string, string, string];
  updatedInvestigation: unknown;
  runtimeSessionId: string;
  datasetIdentity: string;
  reportId: string;
  investigationId: string;
  expectedVersion: number;
  expiresAt: number;
  investigationScore: number;
}) {
  const result = await getRedisClient().eval<string[], string>(
    DELETE_REPORT_SCRIPT,
    input.keys,
    [
      JSON.stringify(input.updatedInvestigation),
      input.runtimeSessionId,
      input.datasetIdentity,
      input.reportId,
      input.investigationId,
      String(input.expectedVersion),
      String(input.expiresAt),
      String(input.investigationScore),
    ],
  );

  return parseAtomicMutationStatus(result);
}

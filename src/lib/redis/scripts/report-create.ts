import "server-only";

import { getRedisClient } from "@/lib/redis/client";

import { parseAtomicMutationStatus } from "./result";

const CREATE_REPORT_SCRIPT = `
local sessionRaw = redis.call('GET', KEYS[6])
if not sessionRaw then return 'expired' end

local sessionOk, session = pcall(cjson.decode, sessionRaw)
if not sessionOk or session.runtimeSessionId ~= ARGV[3] or session.datasetIdentity ~= ARGV[4] then
  return 'conflict'
end

local now = redis.call('TIME')
if tonumber(ARGV[8]) <= tonumber(now[1]) then return 'expired' end

local investigationRaw = redis.call('GET', KEYS[1])
if not investigationRaw then return 'not-found' end

local investigationOk, investigation = pcall(cjson.decode, investigationRaw)
if not investigationOk or investigation.id ~= ARGV[5]
  or investigation.datasetIdentity ~= ARGV[4]
  or (investigation.runtimeSessionId and investigation.runtimeSessionId ~= ARGV[3]) then
  return 'conflict'
end

local existingReportRaw = redis.call('GET', KEYS[3])
if existingReportRaw then
  local pointer = redis.call('GET', KEYS[5])
  if existingReportRaw == ARGV[2] and investigation.status == 'Validated'
    and investigation.reportId == ARGV[6] and pointer == ARGV[6] then
    return 'existing'
  end
  return 'conflict'
end

local currentVersion = tonumber(investigation.version) or 1
if currentVersion ~= tonumber(ARGV[7]) or investigation.status ~= 'Validation ready'
  or not investigation.investigationResult or investigation.investigationResult == cjson.null
  or (investigation.reportId and investigation.reportId ~= cjson.null) then
  return 'conflict'
end

local pointer = redis.call('GET', KEYS[5])
if pointer then return 'conflict' end

local reportOk, report = pcall(cjson.decode, ARGV[2])
if not reportOk or report.id ~= ARGV[6] or report.datasetIdentity ~= ARGV[4]
  or report.investigationCaseId ~= ARGV[5] then
  return 'conflict'
end

local updatedOk, updated = pcall(cjson.decode, ARGV[1])
if not updatedOk or updated.id ~= ARGV[5] or updated.datasetIdentity ~= ARGV[4]
  or updated.runtimeSessionId ~= ARGV[3]
  or tonumber(updated.version) ~= currentVersion + 1
  or updated.status ~= 'Validated' or updated.reportId ~= ARGV[6] then
  return 'conflict'
end

redis.call('SET', KEYS[3], ARGV[2], 'EXAT', ARGV[8])
redis.call('ZADD', KEYS[4], ARGV[10], ARGV[6])
redis.call('EXPIREAT', KEYS[4], ARGV[8])
redis.call('SET', KEYS[5], ARGV[6], 'EXAT', ARGV[8])
redis.call('SET', KEYS[1], ARGV[1], 'EXAT', ARGV[8])
redis.call('ZADD', KEYS[2], ARGV[9], ARGV[5])
redis.call('EXPIREAT', KEYS[2], ARGV[8])
return 'created'
`;

export async function createReportAtomically(input: {
  keys: [string, string, string, string, string, string];
  updatedInvestigation: unknown;
  report: unknown;
  runtimeSessionId: string;
  datasetIdentity: string;
  investigationId: string;
  reportId: string;
  expectedVersion: number;
  expiresAt: number;
  investigationScore: number;
  reportScore: number;
}) {
  const result = await getRedisClient().eval<string[], string>(
    CREATE_REPORT_SCRIPT,
    input.keys,
    [
      JSON.stringify(input.updatedInvestigation),
      JSON.stringify(input.report),
      input.runtimeSessionId,
      input.datasetIdentity,
      input.investigationId,
      input.reportId,
      String(input.expectedVersion),
      String(input.expiresAt),
      String(input.investigationScore),
      String(input.reportScore),
    ],
  );

  return parseAtomicMutationStatus(result);
}

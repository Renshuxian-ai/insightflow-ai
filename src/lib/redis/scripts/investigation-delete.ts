import "server-only";

import { getRedisClient } from "@/lib/redis/client";

import { parseAtomicMutationStatus } from "./result";

const DELETE_INVESTIGATION_SCRIPT = `
local sessionRaw = redis.call('GET', KEYS[7])
if not sessionRaw then return 'expired' end

local sessionOk, session = pcall(cjson.decode, sessionRaw)
if not sessionOk or session.runtimeSessionId ~= ARGV[1] or session.datasetIdentity ~= ARGV[2] then
  return 'conflict'
end

local investigationRaw = redis.call('GET', KEYS[1])
if not investigationRaw then return 'not-found' end

local investigationOk, investigation = pcall(cjson.decode, investigationRaw)
if not investigationOk then return 'conflict' end
local currentVersion = tonumber(investigation.version) or 1
if investigation.id ~= ARGV[3]
  or investigation.datasetIdentity ~= ARGV[2]
  or investigation.signalFingerprint ~= ARGV[4]
  or (investigation.runtimeSessionId and investigation.runtimeSessionId ~= ARGV[1])
  or currentVersion ~= tonumber(ARGV[5]) then
  return 'conflict'
end

local currentReportId = ''
if investigation.reportId and investigation.reportId ~= cjson.null then
  currentReportId = investigation.reportId
end
if currentReportId ~= ARGV[6] then return 'conflict' end

local reportPointer = redis.call('GET', KEYS[4])
if ARGV[6] ~= '' then
  if reportPointer and reportPointer ~= ARGV[6] then return 'conflict' end
  local reportRaw = redis.call('GET', KEYS[5])
  if reportRaw then
    local reportOk, report = pcall(cjson.decode, reportRaw)
    if not reportOk or report.id ~= ARGV[6] or report.datasetIdentity ~= ARGV[2]
      or report.investigationCaseId ~= ARGV[3] then
      return 'conflict'
    end
  end
  redis.call('DEL', KEYS[5])
  redis.call('ZREM', KEYS[6], ARGV[6])
elseif reportPointer then
  return 'conflict'
end

local fingerprintPointer = redis.call('GET', KEYS[3])
if fingerprintPointer == ARGV[3] then
  redis.call('DEL', KEYS[3])
end
redis.call('DEL', KEYS[4])
redis.call('DEL', KEYS[1])
redis.call('ZREM', KEYS[2], ARGV[3])
return 'ok'
`;

export async function deleteInvestigationAtomically(input: {
  keys: [string, string, string, string, string, string, string];
  runtimeSessionId: string;
  datasetIdentity: string;
  investigationId: string;
  signalFingerprint: string;
  expectedVersion: number;
  reportId: string | null;
}) {
  const result = await getRedisClient().eval<string[], string>(
    DELETE_INVESTIGATION_SCRIPT,
    input.keys,
    [
      input.runtimeSessionId,
      input.datasetIdentity,
      input.investigationId,
      input.signalFingerprint,
      String(input.expectedVersion),
      input.reportId ?? "",
    ],
  );

  return parseAtomicMutationStatus(result);
}

import {
  DATASET_ANALYTICS_SEMANTIC_TYPES,
  findAnalyticsField,
  getPercentageScale,
  readCell,
  roundAnalyticsValue,
  toCellText,
  toFiniteNumber,
  toPercentage,
} from "./field-bindings";
import type {
  DatasetAnalyticsBuilderInput,
  DatasetFunnelEvidence,
  DatasetFunnelVersionEvidence,
} from "./types";

type VersionAccumulator = {
  rates: number[];
  users: Set<string>;
  observedRows: number;
};

type TransitionAccumulator = {
  funnelName: string;
  fromStep: string;
  toStep: string;
  eventNames: Set<string>;
  users: Set<string>;
  rates: number[];
  observedRows: number;
  versions: Map<string, VersionAccumulator>;
};

function aggregateVersion(
  version: string,
  evidence: VersionAccumulator,
): DatasetFunnelVersionEvidence {
  return {
    version,
    observedRows: evidence.observedRows,
    users: evidence.users.size,
    completionRate:
      evidence.rates.length === 0
        ? null
        : roundAnalyticsValue(
            evidence.rates.reduce((sum, rate) => sum + rate, 0) /
              evidence.rates.length,
          ),
  };
}

export function buildDatasetFunnelEvidence(
  input: DatasetAnalyticsBuilderInput,
): DatasetFunnelEvidence | null {
  const funnelName = findAnalyticsField(input, {
    names: ["funnel_name", "journey_name"],
  });
  const eventName = findAnalyticsField(input, {
    names: ["event_name", "event_type"],
    semanticTypes: [DATASET_ANALYTICS_SEMANTIC_TYPES.eventName],
  });
  const fromStep = findAnalyticsField(input, {
    names: ["from_step", "source_step"],
  });
  const toStep = findAnalyticsField(input, {
    names: ["to_step", "destination_step"],
  });
  const userIdentifier = findAnalyticsField(input, {
    names: ["user_id", "account_id"],
    semanticTypes: [DATASET_ANALYTICS_SEMANTIC_TYPES.userId],
  });
  const completionRate = findAnalyticsField(input, {
    names: ["step_completion_rate", "completion_rate"],
    semanticTypes: [DATASET_ANALYTICS_SEMANTIC_TYPES.metric],
  });
  const version = findAnalyticsField(input, {
    names: ["release_version", "app_version", "version"],
    semanticTypes: [DATASET_ANALYTICS_SEMANTIC_TYPES.releaseVersion],
  });

  if (!funnelName || !eventName || !fromStep || !toStep) {
    return null;
  }

  const rawRates = completionRate
    ? input.dataset.rows.flatMap((row) => {
        const value = toFiniteNumber(readCell(row, completionRate));
        return value === null ? [] : [value];
      })
    : [];
  const percentageScale = getPercentageScale(rawRates);
  const transitions = new Map<string, TransitionAccumulator>();

  input.dataset.rows.forEach((row, rowIndex) => {
    const funnel = toCellText(readCell(row, funnelName));
    const from = toCellText(readCell(row, fromStep));
    const to = toCellText(readCell(row, toStep));
    const event = toCellText(readCell(row, eventName));

    if (!funnel || !from || !to || !event) {
      return;
    }

    const key = `${funnel}\u0000${from}\u0000${to}`;
    const accumulator = transitions.get(key) ?? {
      funnelName: funnel,
      fromStep: from,
      toStep: to,
      eventNames: new Set<string>(),
      users: new Set<string>(),
      rates: [],
      observedRows: 0,
      versions: new Map<string, VersionAccumulator>(),
    };
    const userId = userIdentifier
      ? toCellText(readCell(row, userIdentifier))
      : null;
    const rowVersion = version ? toCellText(readCell(row, version)) : null;
    const rawRate = completionRate
      ? toFiniteNumber(readCell(row, completionRate))
      : null;
    const rate = rawRate === null
      ? null
      : toPercentage(rawRate, percentageScale);
    const evidenceUser = userId ?? `row-${rowIndex}`;

    accumulator.eventNames.add(event);
    accumulator.users.add(evidenceUser);
    accumulator.observedRows += 1;

    if (rate !== null) {
      accumulator.rates.push(rate);
    }

    if (rowVersion) {
      const versionEvidence = accumulator.versions.get(rowVersion) ?? {
        rates: [],
        users: new Set<string>(),
        observedRows: 0,
      };

      versionEvidence.users.add(evidenceUser);
      versionEvidence.observedRows += 1;

      if (rate !== null) {
        versionEvidence.rates.push(rate);
      }

      accumulator.versions.set(rowVersion, versionEvidence);
    }

    transitions.set(key, accumulator);
  });

  if (transitions.size === 0) {
    return null;
  }

  return {
    fields: {
      funnelName,
      eventName,
      fromStep,
      toStep,
      userIdentifier,
      completionRate,
      version,
    },
    transitions: [...transitions.values()]
      .map((transition) => {
        const rate = transition.rates.length > 0
          ? roundAnalyticsValue(
              transition.rates.reduce((sum, value) => sum + value, 0) /
                transition.rates.length,
            )
          : null;
        const users = transition.users.size;

        return {
          funnelName: transition.funnelName,
          fromStep: transition.fromStep,
          toStep: transition.toStep,
          eventNames: [...transition.eventNames].sort(),
          observedRows: transition.observedRows,
          users,
          completionRate: rate,
          dropOffUsers:
            rate === null ? null : Math.round((users * (100 - rate)) / 100),
          versions: [...transition.versions.entries()]
            .map(([versionName, versionEvidence]) =>
              aggregateVersion(versionName, versionEvidence),
            )
            .sort((left, right) =>
              left.version.localeCompare(right.version, "en-US", {
                numeric: true,
              }),
            ),
        };
      })
      .sort(
        (left, right) =>
          right.observedRows - left.observedRows ||
          left.funnelName.localeCompare(right.funnelName) ||
          left.fromStep.localeCompare(right.fromStep) ||
          left.toStep.localeCompare(right.toStep),
      ),
  };
}

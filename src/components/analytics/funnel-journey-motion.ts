import type { CSSProperties } from "react";

export type JourneyMotionStyle = CSSProperties & {
  "--journey-delay": string;
};

export type FunnelConversionFillStyle = CSSProperties & {
  "--conversion-width": string;
};

export function getJourneyItemDelay(
  itemOrder: number,
  transitionCount: number,
) {
  if (transitionCount <= 1) {
    return 0;
  }

  const cardDelayStep = Math.min(100, 600 / (transitionCount - 1));
  return Math.round((itemOrder / 2) * cardDelayStep);
}

export function getJourneyMotionStyle(
  itemOrder: number,
  transitionCount: number,
): JourneyMotionStyle {
  return {
    "--journey-delay": `${getJourneyItemDelay(itemOrder, transitionCount)}ms`,
  };
}

export function getFunnelConversionFillStyle(
  percentage: number,
): FunnelConversionFillStyle {
  return {
    "--conversion-width": `${Math.max(0, Math.min(100, percentage))}%`,
  };
}

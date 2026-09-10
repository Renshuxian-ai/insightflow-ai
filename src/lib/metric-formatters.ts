export function formatPercentageMagnitude(value: number): string {
  return `${Math.abs(value).toFixed(1)}%`;
}

export function formatSignedPercentageChange(value: number): string {
  const sign = value > 0 ? "+" : "";

  return `${sign}${value.toFixed(1)}%`;
}

export function formatDirectionalPercentageChange(value: number): string {
  const direction = value > 0 ? "↑" : value < 0 ? "↓" : "→";

  return `${direction} ${formatPercentageMagnitude(value)}`;
}

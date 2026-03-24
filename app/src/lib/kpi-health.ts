import type { HealthStatus } from "@/types/database";

interface ThresholdLogic {
  yellow?: number;
  red?: number;
}

export function calculateKpiHealth(
  currentValue: number | null,
  target: number | null,
  directionality: string,
  thresholds: ThresholdLogic
): HealthStatus {
  if (currentValue === null || target === null) return "green";

  const { yellow, red } = thresholds;

  if (directionality === "up_is_good") {
    if (red !== undefined && currentValue <= red) return "red";
    if (yellow !== undefined && currentValue <= yellow) return "yellow";
    return "green";
  }

  if (directionality === "down_is_good") {
    if (red !== undefined && currentValue >= red) return "red";
    if (yellow !== undefined && currentValue >= yellow) return "yellow";
    return "green";
  }

  // target_is_good: distance from target
  if (directionality === "target_is_good") {
    const distance = Math.abs(currentValue - target);
    if (red !== undefined && distance >= red) return "red";
    if (yellow !== undefined && distance >= yellow) return "yellow";
    return "green";
  }

  return "green";
}

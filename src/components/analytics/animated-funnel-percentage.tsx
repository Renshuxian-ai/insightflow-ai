"use client";

import { useEffect, useState } from "react";

import styles from "./funnel-journey-track.module.css";

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

function easeOutQuart(value: number) {
  return 1 - (1 - value) ** 4;
}

export function AnimatedFunnelPercentage({
  value,
  delayMs,
  durationMs = 820,
  className,
}: {
  value: number;
  delayMs: number;
  durationMs?: number;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let animationFrameId: number | null = null;
    let timeoutId: number | null = null;

    function cancelAnimation() {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    }

    if (reducedMotion.matches) {
      return;
    }

    timeoutId = window.setTimeout(() => {
      const startedAt = performance.now();

      function updateValue(now: number) {
        const elapsed = now - startedAt;
        const progress = Math.min(1, elapsed / durationMs);

        setDisplayValue(value * easeOutQuart(progress));

        if (progress < 1) {
          animationFrameId = window.requestAnimationFrame(updateValue);
        }
      }

      animationFrameId = window.requestAnimationFrame(updateValue);
    }, delayMs);
    const handleMotionPreferenceChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        cancelAnimation();
        setDisplayValue(value);
      }
    };

    reducedMotion.addEventListener("change", handleMotionPreferenceChange);

    return () => {
      reducedMotion.removeEventListener(
        "change",
        handleMotionPreferenceChange,
      );
      cancelAnimation();
    };
  }, [delayMs, durationMs, value]);

  return (
    <span className={className}>
      <span className={styles.animatedPercentage}>
        {formatPercentage(displayValue)}
      </span>
      <span className={styles.reducedMotionPercentage}>
        {formatPercentage(value)}
      </span>
    </span>
  );
}

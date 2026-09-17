"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent, type ReactNode } from "react";

import { useDatasetWorkspaceSession } from "@/components/datasets/dataset-workspace-session";
import { RUNTIME_SESSION_HEADER } from "@/lib/runtime-session";

type InvestigationLaunchLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
};

type InvestigationCaseResponse = {
  investigationHref?: unknown;
};

export function InvestigationLaunchLink({
  href,
  className,
  children,
  ariaLabel,
}: InvestigationLaunchLinkProps) {
  const router = useRouter();
  const { datasetMode, runtimeSessionId } = useDatasetWorkspaceSession();
  const [isLaunching, setIsLaunching] = useState(false);

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!datasetMode) {
      return;
    }

    event.preventDefault();

    if (isLaunching) {
      return;
    }

    setIsLaunching(true);

    try {
      const response = await fetch("/api/investigations/cases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [RUNTIME_SESSION_HEADER]: runtimeSessionId,
        },
        body: JSON.stringify({ href }),
      });
      const body = (await response.json()) as InvestigationCaseResponse;

      if (!response.ok || typeof body.investigationHref !== "string") {
        throw new Error("Investigation case creation failed.");
      }

      router.push(body.investigationHref);
    } catch {
      window.alert(
        "This Dataset investigation could not be started. The Dataset session may no longer be available.",
      );
      setIsLaunching(false);
    }
  }

  return (
    <Link
      href={href}
      prefetch={datasetMode ? false : undefined}
      aria-busy={isLaunching}
      aria-label={ariaLabel}
      className={className}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
}

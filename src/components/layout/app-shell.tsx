"use client";

import type { ReactNode } from "react";

import { useAppShellState } from "./app-shell-state";
import { Sidebar, type NavigationSection } from "./sidebar";

type AppShellProps = {
  children: ReactNode;
  activeNavigation?: NavigationSection;
};

export function AppShell({ children, activeNavigation = "overview" }: AppShellProps) {
  const { focusMode } = useAppShellState();

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-[#172033] lg:flex">
      {focusMode ? null : <Sidebar activeNavigation={activeNavigation} />}
      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center border-b border-[#e6e9ef] bg-white px-5 lg:hidden">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-[#3559e8] text-xs font-bold text-white">
              IF
            </div>
            <span className="text-sm font-semibold">InsightFlow AI</span>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

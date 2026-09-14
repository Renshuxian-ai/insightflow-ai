"use client";

import type { ReactNode } from "react";

import { useAppShellState } from "./app-shell-state";
import { Sidebar, type NavigationSection } from "./sidebar";

type AppShellProps = {
  children: ReactNode;
  activeNavigation?: NavigationSection;
};

export function AppShell({ children, activeNavigation = "overview" }: AppShellProps) {
  const { focusMode, sidebarCollapsed } = useAppShellState();

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-[#172033] lg:flex lg:h-screen lg:overflow-hidden">
      {focusMode ? null : (
        <>
          <Sidebar activeNavigation={activeNavigation} />
          <div
            aria-hidden="true"
            className={[
              "hidden shrink-0 transition-[width] duration-200 lg:block",
              sidebarCollapsed ? "w-[68px]" : "w-[248px]",
            ].join(" ")}
          />
        </>
      )}
      <div className="min-w-0 flex-1 lg:h-screen lg:overflow-y-auto">
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

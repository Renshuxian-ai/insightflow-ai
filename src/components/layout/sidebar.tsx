"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { primaryDiagnosticCase } from "@/lib/diagnostics-mock-data";

import { useAppShellState } from "./app-shell-state";

type IconName =
  | "activity"
  | "chart"
  | "database"
  | "document"
  | "funnel"
  | "message"
  | "settings"
  | "sparkles"
  | "trend"
  | "users";

type NavigationItem = {
  id?: NavigationSection;
  label: string;
  icon: IconName;
  href: string;
};

type NavigationGroup = {
  label?: string;
  items: NavigationItem[];
};

const navigationGroups: NavigationGroup[] = [
  {
    items: [
      { id: "overview", label: "Overview", icon: "activity", href: "/" },
      {
        id: "ai-diagnostics",
        label: "AI Diagnostics",
        icon: "sparkles",
        href: `/ai-diagnostics/${primaryDiagnosticCase.id}`,
      },
    ],
  },
  {
    label: "ANALYTICS",
    items: [
      { label: "Trends", icon: "trend", href: "#roadmap" },
      { label: "Funnels", icon: "funnel", href: "#roadmap" },
      { label: "Retention", icon: "chart", href: "#roadmap" },
      { label: "Users", icon: "users", href: "#roadmap" },
    ],
  },
  {
    label: "INSIGHTS",
    items: [
      { label: "Feedback", icon: "message", href: "#roadmap" },
      { label: "Reports", icon: "document", href: "#roadmap" },
    ],
  },
  {
    label: "DATA",
    items: [
      { label: "Events", icon: "activity", href: "#roadmap" },
      {
        id: "data-sources",
        label: "Data Sources",
        icon: "database",
        href: "/data-sources",
      },
    ],
  },
];

export type NavigationSection = "overview" | "ai-diagnostics" | "data-sources";

function NavigationIcon({ name }: { name: IconName }) {
  const commonProps = {
    "aria-hidden": true,
    className: "size-4 shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };

  const paths: Record<IconName, ReactNode> = {
    activity: <path d="M3 12h4l2.2-6 4.2 12 2.1-6H21" strokeLinecap="round" strokeLinejoin="round" />,
    sparkles: <><path d="m12 3 1.5 5.1L18.5 10l-5 1.9L12 17l-1.5-5.1-5-1.9 5-1.9L12 3Z" strokeLinejoin="round" /><path d="m19 16 .6 2.1L22 19l-2.4.9L19 22l-.6-2.1L16 19l2.4-.9L19 16Z" strokeLinejoin="round" /></>,
    trend: <><path d="M4 17 10 11l4 4 6-7" strokeLinecap="round" strokeLinejoin="round" /><path d="M15 8h5v5" strokeLinecap="round" strokeLinejoin="round" /></>,
    funnel: <path d="M4 5h16l-6.5 7.4V19l-3 1.5v-8.1L4 5Z" strokeLinejoin="round" />,
    chart: <path d="M5 19V9m7 10V5m7 14v-7" strokeLinecap="round" />,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.5-3 2.5-5 5.5-5s5 2 5.5 5M16 5.5a3 3 0 0 1 0 5M17 14c2.1.2 3.5 1.9 4 4" strokeLinecap="round" /></>,
    message: <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.6-.8L4 20l1.3-3.8A7 7 0 0 1 4 12a7.5 7.5 0 0 1 8-7.5 7.5 7.5 0 0 1 8 7Z" strokeLinejoin="round" />,
    document: <><path d="M7 3h7l4 4v14H7V3Z" strokeLinejoin="round" /><path d="M14 3v5h4M10 13h4m-4 4h4" strokeLinecap="round" /></>,
    database: <><ellipse cx="12" cy="5.5" rx="7" ry="3" /><path d="M5 5.5v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6M5 11.5v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
    settings: <><circle cx="12" cy="12" r="3.5" /><path d="m19.4 15 .1.1 1.2 1.1-2 3.4-1.6-.6a8 8 0 0 1-2.1 1.2L14.7 22h-4l-.3-1.8a8 8 0 0 1-2.1-1.2l-1.6.6-2-3.4 1.2-1.1.1-.1a8.8 8.8 0 0 1 0-2l-.1-.1-1.2-1.1 2-3.4 1.6.6A8 8 0 0 1 10.3 7l.3-1.8h4l.3 1.8a8 8 0 0 1 2.1 1.2l1.6-.6 2 3.4-1.2 1.1-.1.1a8.8 8.8 0 0 1 .1 2.8Z" strokeLinecap="round" strokeLinejoin="round" /></>,
  };

  return <svg {...commonProps}>{paths[name]}</svg>;
}

function SidebarTooltip({ label }: { label: string }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#172033] px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {label}
    </span>
  );
}

function SidebarLink({
  item,
  active,
  collapsed,
}: {
  item: NavigationItem;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={[
        "group relative flex h-9 items-center rounded-lg text-[13px] font-medium transition-colors",
        collapsed ? "mx-auto w-10 justify-center px-0" : "gap-3 px-2.5",
        active
          ? "bg-[#edf1ff] text-[#3559e8]"
          : "text-[#657084] hover:bg-[#f6f7f9] hover:text-[#263247]",
      ].join(" ")}
    >
      <NavigationIcon name={item.icon} />
      <span className={collapsed ? "sr-only" : undefined}>{item.label}</span>
      {collapsed ? <SidebarTooltip label={item.label} /> : null}
    </Link>
  );
}

export function Sidebar({ activeNavigation }: { activeNavigation: NavigationSection }) {
  const { sidebarCollapsed, toggleSidebar } = useAppShellState();

  return (
    <aside
      className={[
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[#e6e9ef] bg-white transition-[width] duration-200 lg:flex",
        sidebarCollapsed ? "w-[68px]" : "w-[248px]",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-[76px] shrink-0 items-center border-b border-[#eef0f4]",
          sidebarCollapsed ? "justify-center px-3" : "gap-3 px-5",
        ].join(" ")}
      >
        <div className="grid size-9 place-items-center rounded-xl bg-[#3559e8] text-xs font-bold tracking-tight text-white shadow-[0_6px_16px_rgba(53,89,232,0.22)]">IF</div>
        <div className={sidebarCollapsed ? "hidden" : undefined}>
          <p className="text-sm font-semibold tracking-[-0.01em] text-[#172033]">InsightFlow AI</p>
          <p className="mt-0.5 text-[11px] text-[#7e8798]">Product intelligence</p>
        </div>
      </div>

      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-16 z-20 grid size-6 place-items-center rounded-full border border-[#dfe3eb] bg-white text-[#7e8798] shadow-sm transition-colors hover:border-[#c8cfda] hover:text-[#3559e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3559e8]/30"
      >
        <svg
          aria-hidden="true"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          viewBox="0 0 24 24"
        >
          <path
            d={sidebarCollapsed ? "m9 5 7 7-7 7" : "m15 5-7 7 7 7"}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <nav
        className={[
          "min-h-0 flex-1 py-4",
          sidebarCollapsed ? "overflow-visible px-2" : "overflow-y-auto px-3",
        ].join(" ")}
        aria-label="Primary navigation"
      >
        {navigationGroups.map((group, groupIndex) => (
          <div
            key={group.label ?? "primary"}
            className={groupIndex === 0 ? "" : sidebarCollapsed ? "mt-4" : "mt-6"}
          >
            {group.label ? (
              sidebarCollapsed ? (
                <div
                  className="mx-auto mb-2 h-px w-7 bg-[#eef0f4]"
                  aria-label={group.label}
                  role="separator"
                />
              ) : (
                <p className="px-2 pb-2 text-[10px] font-semibold tracking-[0.12em] text-[#9aa2b1]">
                  {group.label}
                </p>
              )
            ) : null}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <SidebarLink
                  key={item.label}
                  item={item}
                  active={item.id === activeNavigation}
                  collapsed={sidebarCollapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[#eef0f4] p-3">
        <SidebarLink
          item={{ label: "Settings", icon: "settings", href: "#roadmap" }}
          active={false}
          collapsed={sidebarCollapsed}
        />
      </div>
    </aside>
  );
}

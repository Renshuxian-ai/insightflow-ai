"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { UploadIcon } from "@/components/icons/upload-icon";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useLanguage } from "@/components/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/translate";
import { useAppShellState } from "./app-shell-state";

type IconName =
  | "activity"
  | "chart"
  | "database"
  | "document"
  | "funnel"
  | "layout-dashboard"
  | "list-tree"
  | "message"
  | "settings"
  | "sparkles"
  | "trend"
  | "upload"
  | "users";

type NavigationItem = {
  id?: NavigationSection;
  labelKey: TranslationKey;
  icon: IconName;
  href: string;
};

type NavigationGroup = {
  labelKey?: TranslationKey;
  items: NavigationItem[];
};

const navigationGroups: NavigationGroup[] = [
  {
    items: [
      {
        id: "overview",
        labelKey: "nav.overview",
        icon: "layout-dashboard",
        href: "/",
      },
      {
        id: "ai-diagnostics",
        labelKey: "nav.aiDiagnostics",
        icon: "sparkles",
        href: "/ai-diagnostics",
      },
    ],
  },
  {
    labelKey: "nav.analytics",
    items: [
      {
        id: "analytics-trends",
        labelKey: "nav.trends",
        icon: "trend",
        href: "/analytics/trends",
      },
      {
        id: "analytics-funnels",
        labelKey: "nav.funnels",
        icon: "funnel",
        href: "/analytics/funnels",
      },
      {
        id: "analytics-retention",
        labelKey: "nav.retention",
        icon: "chart",
        href: "/analytics/retention",
      },
      { labelKey: "nav.users", icon: "users", href: "#roadmap" },
    ],
  },
  {
    labelKey: "nav.insights",
    items: [
      { id: "feedback", labelKey: "nav.feedback", icon: "message", href: "/feedback" },
      {
        id: "investigations",
        labelKey: "nav.investigations",
        icon: "activity",
        href: "/investigations",
      },
      { id: "reports", labelKey: "nav.reports", icon: "document", href: "/reports" },
    ],
  },
  {
    labelKey: "nav.data",
    items: [
      { labelKey: "nav.events", icon: "list-tree", href: "#roadmap" },
      {
        id: "data-sources",
        labelKey: "nav.dataSources",
        icon: "upload",
        href: "/data-sources",
      },
    ],
  },
];

export type NavigationSection =
  | "overview"
  | "ai-diagnostics"
  | "analytics-trends"
  | "analytics-funnels"
  | "analytics-retention"
  | "feedback"
  | "investigations"
  | "reports"
  | "data-sources";

function NavigationIcon({ name }: { name: IconName }) {
  if (name === "upload") {
    return <UploadIcon className="size-4 shrink-0" />;
  }

  const commonProps = {
    "aria-hidden": true,
    className: "size-4 shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };

  const paths: Record<Exclude<IconName, "upload">, ReactNode> = {
    activity: <path d="M3 12h4l2.2-6 4.2 12 2.1-6H21" strokeLinecap="round" strokeLinejoin="round" />,
    "layout-dashboard": <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
    "list-tree": <><path d="M8 6h13M13 12h8M13 18h8" strokeLinecap="round" /><path d="M3 6h.01M3 12h.01M3 18h.01M8 6v12M8 12h5M8 18h5" strokeLinecap="round" strokeLinejoin="round" /></>,
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
  label,
  active,
  collapsed,
}: {
  item: NavigationItem;
  label: string;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={[
        "group relative flex h-9 items-center rounded-lg text-[13px] font-medium transition-colors",
        collapsed ? "mx-auto w-10 justify-center px-0" : "gap-3 px-2.5",
        active
          ? "bg-[#edf1ff] text-[#3559e8]"
          : "text-[#657084] hover:bg-[#f6f7f9] hover:text-[#263247]",
      ].join(" ")}
    >
      <NavigationIcon name={item.icon} />
      <span className={collapsed ? "sr-only" : undefined}>{label}</span>
      {collapsed ? <SidebarTooltip label={label} /> : null}
    </Link>
  );
}

export function Sidebar({ activeNavigation }: { activeNavigation: NavigationSection }) {
  const { sidebarCollapsed, toggleSidebar } = useAppShellState();
  const { t } = useLanguage();
  const sidebarToggleLabel = t(
    sidebarCollapsed ? "sidebar.expand" : "sidebar.collapse",
  );

  return (
    <aside
      className={[
        "fixed top-0 left-0 z-30 hidden h-screen shrink-0 flex-col border-r border-[#e6e9ef] bg-white transition-[width] duration-200 lg:flex",
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
          <p className="mt-0.5 text-[11px] text-[#7e8798]">
            {t("brand.tagline")}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={sidebarToggleLabel}
        title={sidebarToggleLabel}
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
          "sidebar-scroll-region min-h-0 flex-1 py-4",
          sidebarCollapsed
            ? "overflow-visible px-2"
            : "overflow-x-hidden overflow-y-auto px-3",
        ].join(" ")}
        aria-label={t("nav.primary")}
      >
        {navigationGroups.map((group, groupIndex) => (
          <div
            key={group.labelKey ?? "primary"}
            className={groupIndex === 0 ? "" : sidebarCollapsed ? "mt-4" : "mt-6"}
          >
            {group.labelKey ? (
              sidebarCollapsed ? (
                <div
                  className="mx-auto mb-2 h-px w-7 bg-[#eef0f4]"
                  aria-label={t(group.labelKey)}
                  role="separator"
                />
              ) : (
                <p className="px-2 pb-2 text-[10px] font-semibold tracking-[0.12em] text-[#9aa2b1]">
                  {t(group.labelKey)}
                </p>
              )
            ) : null}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <SidebarLink
                  key={item.id ?? item.href}
                  item={item}
                  label={t(item.labelKey)}
                  active={item.id === activeNavigation}
                  collapsed={sidebarCollapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[#eef0f4] p-3">
        <LanguageSwitcher compact={sidebarCollapsed} />
        <div className="mt-2">
          <SidebarLink
            item={{ labelKey: "nav.settings", icon: "settings", href: "#roadmap" }}
            label={t("nav.settings")}
            active={false}
            collapsed={sidebarCollapsed}
          />
        </div>
      </div>
    </aside>
  );
}

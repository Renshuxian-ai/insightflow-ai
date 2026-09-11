"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

type AppShellState = {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  toggleSidebar: () => void;
  focusMode: boolean;
  setFocusMode: Dispatch<SetStateAction<boolean>>;
};

const AppShellStateContext = createContext<AppShellState | null>(null);

export function AppShellStateProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const value = useMemo<AppShellState>(
    () => ({
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebar: () => setSidebarCollapsed((current) => !current),
      focusMode,
      setFocusMode,
    }),
    [focusMode, sidebarCollapsed],
  );

  return (
    <AppShellStateContext.Provider value={value}>
      {children}
    </AppShellStateContext.Provider>
  );
}

export function useAppShellState() {
  const context = useContext(AppShellStateContext);

  if (!context) {
    throw new Error(
      "useAppShellState must be used within an AppShellStateProvider.",
    );
  }

  return context;
}

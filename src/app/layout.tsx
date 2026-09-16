import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { DatasetWorkspaceSessionProvider } from "@/components/datasets/dataset-workspace-session";
import { LanguageProvider } from "@/components/i18n/language-provider";
import { AppShellStateProvider } from "@/components/layout/app-shell-state";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InsightFlow AI | 产品洞察",
  description: "面向产品团队的产品诊断与用户洞察工作台。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider>
          <AppShellStateProvider>
            <DatasetWorkspaceSessionProvider>
              {children}
            </DatasetWorkspaceSessionProvider>
          </AppShellStateProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

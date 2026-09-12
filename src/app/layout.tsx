import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { DatasetWorkspaceSessionProvider } from "@/components/datasets/dataset-workspace-session";
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
  title: "InsightFlow AI | Product intelligence",
  description:
    "A product diagnostics and user insights workspace for product teams.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppShellStateProvider>
          <DatasetWorkspaceSessionProvider>
            {children}
          </DatasetWorkspaceSessionProvider>
        </AppShellStateProvider>
      </body>
    </html>
  );
}

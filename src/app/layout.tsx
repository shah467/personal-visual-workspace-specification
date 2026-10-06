import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/state/theme-provider";
import { WorkspaceProvider } from "@/state/workspace-provider";
import { CanvasUIProvider } from "@/state/canvas-ui-provider";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";

const inter = Inter({ subsets: ["latin"], variable: "--font-app", display: "swap" });

export const metadata: Metadata = {
  title: "Workspace — Personal Visual Workspace",
  description: "An infinite visual canvas for ideas, projects and everything that matters.",
  manifest: "/manifest.webmanifest",
  applicationName: "Workspace",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Workspace",
  },
  icons: {
    icon: [{ url: "/icons/icon.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/icons/icon.png", sizes: "512x512", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0b" },
    { media: "(prefers-color-scheme: light)", color: "#f4f3ef" },
  ],
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('pvw.theme-mode.v1');
    var mode = stored || 'system';
    var resolved = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : mode;
    document.documentElement.dataset.theme = resolved;
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
  }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <WorkspaceProvider>
            <CanvasUIProvider>{children}</CanvasUIProvider>
          </WorkspaceProvider>
        </ThemeProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { VisualEditsMessenger } from "orchids-visual-edits";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "sonner";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "PayoutPower — Incentive Management",
  description: "PayoutPower IMS — Incentive Management Dashboard for sales teams",
};

import { LoadingProvider } from "@/components/ui/global-loader";
import { SyncProvider } from "@/components/ui/sync-status";
import { Suspense } from "react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} antialiased font-sans`}
      >
        <Suspense fallback={null}>
          <SyncProvider>
            <LoadingProvider>
              <AuthProvider>
                {children}
                <Toaster position="top-right" richColors />
              </AuthProvider>
            </LoadingProvider>
          </SyncProvider>
        </Suspense>
        <VisualEditsMessenger />
      </body>
    </html>
  );
}

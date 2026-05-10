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
  title: "IncentivePro — Incentive Management",
  description: "IncentivePro IMS — Incentive Management Dashboard for sales teams",
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
        className={`${outfit.variable} antialiased font-sans min-h-screen flex flex-col`}
      >
        <Suspense fallback={null}>
          <SyncProvider>
            <LoadingProvider>
              <AuthProvider>
                {children}
                <footer className="w-full py-4 border-t border-slate-100/50 bg-white/30 backdrop-blur-sm mt-auto">
                  <div className="max-w-7xl mx-auto px-6 flex justify-center items-center">
                    <p className="text-[10px] sm:text-xs font-medium text-slate-400 tracking-tight">
                      Developed and Powered by{" "}
                      <a
                        href="https://arcwebworks.in"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-600 hover:text-blue-600 transition-colors font-semibold"
                      >
                        Arc WebWorks
                      </a>
                    </p>
                  </div>
                </footer>
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

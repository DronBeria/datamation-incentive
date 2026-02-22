"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2, WifiOff, RefreshCcw } from "lucide-react";

type LoadingState = "none" | "loading" | "slow" | "very-slow";

interface LoadingContextType {
    setIsLoading: (loading: boolean) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const useLoading = () => {
    const context = useContext(LoadingContext);
    if (!context) throw new Error("useLoading must be used within LoadingProvider");
    return context;
};

export function LoadingProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [state, setState] = useState<LoadingState>("none");
    const [progress, setProgress] = useState(0);

    // This handles manual loading states from components
    const setIsLoading = (loading: boolean) => {
        if (loading) {
            setState("loading");
            setProgress(30);
        } else {
            setProgress(100);
            setTimeout(() => {
                setState("none");
                setProgress(0);
            }, 300);
        }
    };

    // Auto-reset on route change
    useEffect(() => {
        setProgress(100);
        setTimeout(() => {
            setState("none");
            setProgress(0);
        }, 300);
    }, [pathname, searchParams]);

    // Track slow loading
    useEffect(() => {
        if (state === "none") return;

        const slowTimer = setTimeout(() => setState("slow"), 3500);
        const verySlowTimer = setTimeout(() => setState("very-slow"), 8000);

        const progressInterval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 90) return prev;
                return prev + (prev < 60 ? 2 : 0.5);
            });
        }, 150);

        return () => {
            clearTimeout(slowTimer);
            clearTimeout(verySlowTimer);
            clearInterval(progressInterval);
        };
    }, [state]);

    return (
        <LoadingContext.Provider value={{ setIsLoading }}>
            {/* Top Progress Bar */}
            {state !== "none" && (
                <div className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-slate-100">
                    <div
                        className={`h-full transition-all duration-300 ease-out ${state === 'slow' ? 'bg-amber-500' :
                                state === 'very-slow' ? 'bg-red-500' : 'bg-blue-600'
                            }`}
                        style={{ width: `${progress}%` }}
                    />

                    {/* Pulsing Glow */}
                    <div
                        className={`absolute top-0 h-full w-20 blur-md -translate-x-full animate-[shimmer_1.5s_infinite] ${state === 'slow' ? 'bg-amber-400/30' :
                                state === 'very-slow' ? 'bg-red-400/30' : 'bg-blue-400/30'
                            }`}
                        style={{ left: `${progress}%` }}
                    />
                </div>
            )}

            {/* Industrial Overlay for Slow Connections */}
            {(state === "slow" || state === "very-slow") && (
                <div className="fixed bottom-6 right-6 z-[9998] animate-in slide-in-from-right-10 duration-500">
                    <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 flex items-center gap-4 max-w-sm">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${state === 'very-slow' ? 'bg-red-50' : 'bg-amber-50'
                            }`}>
                            {state === 'very-slow' ? (
                                <WifiOff className="h-5 w-5 text-red-600" />
                            ) : (
                                <RefreshCcw className="h-5 w-5 text-amber-600 animate-spin" />
                            )}
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-900 uppercase tracking-widest leading-none mb-1">
                                {state === 'very-slow' ? 'Connectivity Alert' : 'Syncing Data'}
                            </p>
                            <p className="text-[11px] font-medium text-slate-500 leading-tight">
                                {state === 'very-slow'
                                    ? 'Significant latency detected. Please check your internet connection.'
                                    : 'Optimizing cloud synchronization for your current bandwidth...'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {children}
        </LoadingContext.Provider>
    );
}

export function GlobalLoader() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 animate-in fade-in duration-700">
            <div className="relative">
                <div className="h-16 w-16 rounded-2xl border-2 border-slate-100 flex items-center justify-center bg-white shadow-sm overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-50 to-indigo-50/30 animate-pulse" />
                    <Loader2 className="h-8 w-8 text-blue-600 animate-spin relative z-10" />
                </div>
                {/* Micro-bubbles */}
                <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-blue-500 border-2 border-white animate-bounce" />
            </div>
            <div className="text-center">
                <p className="text-sm font-heading text-slate-900 tracking-tight">Initializing Portal</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2 animate-pulse">
                    Synchronizing Assets
                </p>
            </div>
        </div>
    );
}

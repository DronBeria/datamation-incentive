"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { Cloud, CloudCheck, CloudOff, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

type SyncState = 'saved' | 'saving' | 'error' | 'offline';

interface SyncContextType {
    state: SyncState;
    isOnline: boolean;
}

const SyncContext = createContext<SyncContextType>({ state: 'saved', isOnline: true });

export const useSyncStatus = () => useContext(SyncContext);

export function SyncProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<SyncState>('saved');
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        setIsOnline(navigator.onLine);

        const handleOnline = () => {
            setIsOnline(true);
            toast.success("Connection Restored", {
                description: "Global cloud synchronization resumed.",
                duration: 3000
            });
        };

        const handleOffline = () => {
            setIsOnline(false);
            setState('offline');
            toast.error("Offline Mode Activated", {
                description: "Sync suspended. Data will be cached locally.",
                duration: Infinity
            });
        };

        const handleSync = (e: any) => {
            setState(e.detail);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('hybrid-sync', handleSync);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('hybrid-sync', handleSync);
        };
    }, []);

    return (
        <SyncContext.Provider value={{ state, isOnline }}>
            {children}
        </SyncContext.Provider>
    );
}

export function SyncStatusIcon() {
    const { state, isOnline } = useSyncStatus();

    if (!isOnline || state === 'offline') {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-100 animate-pulse group cursor-help">
                <WifiOff className="h-3.5 w-3.5 text-rose-500" />
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-tight">Offline</span>
                {/* Tooltip-like popup on hover */}
                <div className="absolute top-12 right-0 hidden group-hover:block w-64 p-3 bg-white shadow-2xl rounded-xl border border-slate-200 z-[100] animate-in fade-in zoom-in duration-200">
                    <p className="text-xs font-bold text-slate-900 mb-1 flex items-center gap-2">
                        <AlertCircle className="h-3 w-3 text-rose-500" />
                        Sync Suspended
                    </p>
                    <p className="text-[10px] text-slate-500 leading-normal font-medium">
                        Your internet connection is unstable. All changes are being stored in the industrial local buffer. They will sync once online.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3 pr-2">
            <div className="relative group flex items-center">
                {state === 'saving' ? (
                    <div className="flex items-center gap-2">
                        <div className="relative h-4 w-4">
                            <Cloud className="h-4 w-4 text-slate-300" />
                            <div className="absolute inset-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin scale-75" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">Syncing</span>
                    </div>
                ) : state === 'error' ? (
                    <div className="flex items-center gap-2">
                        <CloudOff className="h-4 w-4 text-rose-500" />
                        <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">Error</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 transition-all duration-500 animate-in fade-in">
                        <div className="relative h-5 w-5 flex items-center justify-center">
                            <Cloud className="h-4 w-4 text-slate-200 fill-slate-50" />
                            <div className="absolute inset-0 flex items-center justify-center translate-x-[4px] translate-y-[2px]">
                                <div className="h-3 w-3 rounded-full bg-white flex items-center justify-center shadow-sm border border-emerald-100">
                                    <svg viewBox="0 0 24 24" className="h-2 w-2 text-emerald-500 fill-none stroke-[4]" stroke="currentColor">
                                        <path d="M20 6L9 17L4 12" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest group-hover:text-slate-500 transition-colors">Backed Up</span>
                    </div>
                )}
            </div>
        </div>
    );
}

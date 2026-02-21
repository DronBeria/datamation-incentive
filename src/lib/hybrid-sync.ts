/**
 * PayoutPower Industrial Hybrid Sync Engine
 * Handles the bridge between Cloud (Supabase) and Local (Disk/Electron)
 */

export const syncToLocal = async (entity: string, data: any) => {
    // 1. Detect if running inside Electron
    const isElectron = typeof window !== 'undefined' && window.process && (window.process as any).type === 'renderer' ||
        (typeof window !== 'undefined' && (window as any).electron);

    if (!isElectron) {
        // If not in electron, we might store in IndexedDB or just skip
        // For Vercel deployment, we just skip local file system sync
        return;
    }

    try {
        // 2. Call the Electron IPC bridge to write to disk
        // This expects 'electron' to be exposed via preload script
        if ((window as any).electron?.saveBackup) {
            await (window as any).electron.saveBackup(entity, data);
            console.log(`[HybridSync] Local backup created for ${entity}`);
        }
    } catch (err) {
        console.error("[HybridSync] Local backup failed:", err);
    }
};

/**
 * Checks if the system is running in standalone desktop mode
 */
export const isDesktopMode = () => {
    return typeof window !== 'undefined' && (!!(window as any).electron || navigator.userAgent.toLowerCase().includes('electron'));
};

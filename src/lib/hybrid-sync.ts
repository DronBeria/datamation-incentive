/**
 * IncentivePro Industrial Hybrid Sync Engine
 * Handles the bridge between Cloud (Supabase) and Local (Disk/Electron)
 */

export const syncToLocal = async (entity: string, data: any) => {
    // 1. Detect if running inside Electron
    const isElectron = typeof window !== 'undefined' && window.process && (window.process as any).type === 'renderer' ||
        (typeof window !== 'undefined' && (window as any).electron);

    if (!isElectron) return;

    // Emit 'saving' status
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hybrid-sync', { detail: 'saving' }));
    }

    try {
        // 2. Call the Electron IPC bridge to write to disk
        if ((window as any).electron?.saveBackup) {
            await (window as any).electron.saveBackup(entity, data);

            // Emit success
            if (typeof window !== 'undefined') {
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('hybrid-sync', { detail: 'saved' }));
                }, 800); // Visual sustain
            }
        }
    } catch (err) {
        console.error("[HybridSync] Local backup failed:", err);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('hybrid-sync', { detail: 'error' }));
        }
    }
};

export const isDesktopMode = () => {
    return typeof window !== 'undefined' && (!!(window as any).electron || navigator.userAgent.toLowerCase().includes('electron'));
};

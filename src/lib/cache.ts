// Redis-Compatible Memory Cache for High-Traffic Dashboards
// In production, this can be swapped with real Redis (e.g. ioredis or @upstash/redis)
// by replacing the Map operations with redis.get/set.

interface CacheItem {
    value: any;
    expiry: number;
}

const store = new Map<string, CacheItem>();

export const Cache = {
    /**
     * Retrieves data from the cache.
     */
    get: async (key: string): Promise<any | null> => {
        const item = store.get(key);
        if (!item) return null;

        if (Date.now() > item.expiry) {
            store.delete(key);
            return null;
        }
        return item.value;
    },

    /**
     * Sets data in the cache with a predefined TTL
     * @param key cache key
     * @param value data payload
     * @param ttlSeconds seconds until expiration (default 300 = 5 mins)
     */
    set: async (key: string, value: any, ttlSeconds: number = 300): Promise<void> => {
        store.set(key, {
            value,
            expiry: Date.now() + (ttlSeconds * 1000)
        });
    },

    /**
     * Invalidates a specific cache key
     */
    del: async (key: string): Promise<void> => {
        store.delete(key);
    },

    /**
     * Clears the entire cache (useful for total invalidation hooks)
     */
    flush: async (): Promise<void> => {
        store.clear();
    }
};

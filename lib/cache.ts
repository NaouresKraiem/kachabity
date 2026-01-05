// Simple in-memory cache for server-side data
// This will cache data for a short time to reduce database queries

interface CacheItem<T> {
    data: T;
    timestamp: number;
}

class SimpleCache {
    private cache: Map<string, CacheItem<any>> = new Map();
    private defaultTTL: number = 60000; // 1 minute default

    set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now() + ttl
        });
    }

    get<T>(key: string): T | null {
        const item = this.cache.get(key);

        if (!item) return null;

        // Check if expired
        if (Date.now() > item.timestamp) {
            this.cache.delete(key);
            return null;
        }

        return item.data as T;
    }

    clear(key?: string): void {
        if (key) {
            this.cache.delete(key);
        } else {
            this.cache.clear();
        }
    }

    // Clear expired items periodically
    cleanup(): void {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now > item.timestamp) {
                this.cache.delete(key);
            }
        }
    }
}

// Singleton instance
const cache = new SimpleCache();

// Cleanup every 5 minutes
if (typeof window === 'undefined') {
    setInterval(() => cache.cleanup(), 5 * 60 * 1000);
}

export default cache;

// Cache durations (in milliseconds)
export const CACHE_DURATION = {
    PRODUCTS: 2 * 60 * 1000,      // 2 minutes
    CATEGORIES: 5 * 60 * 1000,    // 5 minutes  
    REELS: 3 * 60 * 1000,         // 3 minutes
    PROMOTIONS: 1 * 60 * 1000,    // 1 minute
    BANNERS: 5 * 60 * 1000,       // 5 minutes
};


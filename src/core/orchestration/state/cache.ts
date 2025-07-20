// src/core/orchestration/state/cache.ts

import { createClient, RedisClientType } from 'redis';
import { DistributedState } from './wrapper';

export class StateCache {
    private localCache: Map<string, DistributedState>;
    private redisClient: RedisClientType;

    constructor() {
        this.localCache = new Map();
        this.redisClient = createClient();
        this.redisClient.connect();
    }

    async getState(key: string): Promise<DistributedState | null> {
        if (this.localCache.has(key)) {
            return this.localCache.get(key)!;
        }

        const remoteState = await this.redisClient.get(key);
        if (remoteState) {
            const state = new DistributedState(key);
            // In a real implementation, we would deserialize the remote state
            // and merge it into the new DistributedState instance.
            this.localCache.set(key, state);
            return state;
        }

        return null;
    }

    async setState(key: string, state: DistributedState): Promise<void> {
        this.localCache.set(key, state);
        // In a real implementation, we would serialize the state before
        // setting it in Redis.
        await this.redisClient.set(key, JSON.stringify(state));
    }
} 
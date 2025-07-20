// src/core/lifecycle/fault-tolerance/circuit-breaker.ts

import CircuitBreaker from 'opossum';

export function createCircuitBreaker<T extends unknown[], R>(
    action: (...args: T) => Promise<R>
): CircuitBreaker<T, R> {
    const options = {
        timeout: 3000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
    };

    return new CircuitBreaker(action, options);
} 
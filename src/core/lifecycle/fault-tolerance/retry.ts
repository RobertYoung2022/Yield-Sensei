// src/core/lifecycle/fault-tolerance/retry.ts

export function Retryable(retries: number = 3, delay: number = 1000) {
    return function (
        _target: any,
        _propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            for (let i = 0; i < retries; i++) {
                try {
                    return await originalMethod.apply(this, args);
                } catch (error) {
                    if (i === retries - 1) throw error;
                    await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)));
                }
            }
        };

        return descriptor;
    };
} 
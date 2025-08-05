
/**
 * Shared Logger Infrastructure - Legacy Compatibility Layer
 * Maintains backward compatibility while using new shared logger system
 */

import { getLogger as getSharedLogger, LogLevel, ILogger } from '../utils/logger';

class Logger {
    private static loggers: Map<string, ILogger> = new Map();

    public static getLogger(serviceName: string): ILogger {
        if (!this.loggers.has(serviceName)) {
            const logger = getSharedLogger(serviceName);
            this.loggers.set(serviceName, logger);
        }
        return this.loggers.get(serviceName)!;
    }
}

export default Logger;

// Named export for convenience - backward compatibility
export const getLogger = (options: { name: string, level?: string }) => {
    const logLevel = options.level ? options.level as LogLevel : LogLevel.INFO;
    return getSharedLogger(options.name, { level: logLevel });
};

// Re-export types and utilities from shared logger
export * from '../utils/logger';

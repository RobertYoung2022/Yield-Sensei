
import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';

class Logger {
    private static loggers: Map<string, WinstonLogger> = new Map();

    public static getLogger(serviceName: string): WinstonLogger {
        if (!this.loggers.has(serviceName)) {
            const newLogger = createLogger({
                level: 'info',
                format: format.combine(
                    format.timestamp(),
                    format.json()
                ),
                defaultMeta: { service: serviceName },
                transports: [new transports.Console()],
            });
            this.loggers.set(serviceName, newLogger);
        }
        return this.loggers.get(serviceName)!;
    }
}

export default Logger;

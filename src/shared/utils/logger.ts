/**
 * Shared Logger Infrastructure
 * Centralized logging system with TypeScript interfaces and structured logging
 */

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn', 
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace'
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  satelliteId?: string;
  taskId?: string;
  correlationId?: string;
  operationId?: string;
  [key: string]: any;
}

export interface LogMetadata {
  timestamp: Date;
  service: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
  duration?: number;
  tags?: string[];
  [key: string]: any;
}

export interface ILogger {
  error(message: string, context?: LogContext, error?: Error): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  trace(message: string, context?: LogContext): void;
  
  withContext(context: LogContext): ILogger;
  child(context: LogContext): ILogger;
  
  startTimer(label: string): () => void;
  addTags(tags: string[]): ILogger;
}

export interface LoggerConfig {
  service: string;
  level?: LogLevel;
  enableConsole?: boolean;
  enableFile?: boolean;
  filePath?: string;
  enableStructured?: boolean;
  context?: LogContext;
}

class Logger implements ILogger {
  private service: string;
  private level: LogLevel;
  private context: LogContext;
  private tags: string[];
  private config: LoggerConfig;

  constructor(config: LoggerConfig) {
    this.service = config.service;
    this.level = config.level || LogLevel.INFO;
    this.context = config.context || {};
    this.tags = [];
    this.config = config;
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  trace(message: string, context?: LogContext): void {
    this.log(LogLevel.TRACE, message, context);
  }

  withContext(context: LogContext): ILogger {
    const newLogger = new Logger(this.config);
    newLogger.context = { ...this.context, ...context };
    newLogger.tags = [...this.tags];
    return newLogger;
  }

  child(context: LogContext): ILogger {
    return this.withContext(context);
  }

  startTimer(label: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.info(`${label} completed`, { duration });
    };
  }

  addTags(tags: string[]): ILogger {
    const newLogger = new Logger(this.config);
    newLogger.context = { ...this.context };
    newLogger.tags = [...this.tags, ...tags];
    return newLogger;
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const metadata: LogMetadata = {
      timestamp: new Date(),
      service: this.service,
      level,
      message,
      context: { ...this.context, ...context },
      ...(error && { error }),
      ...(this.tags.length > 0 && { tags: this.tags })
    };

    this.output(metadata);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG, LogLevel.TRACE];
    const currentLevelIndex = levels.indexOf(this.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  private output(metadata: LogMetadata): void {
    if (this.config.enableStructured !== false) {
      // Structured JSON output
      console.log(JSON.stringify(metadata));
    } else {
      // Simple formatted output
      const timestamp = metadata.timestamp.toISOString();
      const context = metadata.context ? ` [${JSON.stringify(metadata.context)}]` : '';
      const tags = metadata.tags ? ` [${metadata.tags.join(', ')}]` : '';
      console.log(`${timestamp} [${metadata.level.toUpperCase()}] ${metadata.service}: ${metadata.message}${context}${tags}`);
      
      if (metadata.error) {
        console.error(metadata.error);
      }
    }
  }
}

// Logger factory for creating and managing logger instances
export class LoggerFactory {
  private static loggers: Map<string, ILogger> = new Map();
  private static globalContext: LogContext = {};

  static getLogger(service: string, config?: Partial<LoggerConfig>): ILogger {
    const key = service;
    
    if (!this.loggers.has(key)) {
      const loggerConfig: LoggerConfig = {
        service,
        level: LogLevel.INFO,
        enableConsole: true,
        enableStructured: true,
        context: { ...this.globalContext },
        ...config
      };
      
      const logger = new Logger(loggerConfig);
      this.loggers.set(key, logger);
    }
    
    return this.loggers.get(key)!;
  }

  static setGlobalContext(context: LogContext): void {
    this.globalContext = { ...this.globalContext, ...context };
  }

  static setGlobalLogLevel(level: LogLevel): void {
    // Update all existing loggers
    this.loggers.forEach((logger, service) => {
      this.loggers.set(service, this.getLogger(service, { level }));
    });
  }

  static clear(): void {
    this.loggers.clear();
  }
}

// Convenience exports
export const getLogger = (service: string, config?: Partial<LoggerConfig>): ILogger => {
  return LoggerFactory.getLogger(service, config);
};

export const setGlobalLogLevel = (level: LogLevel): void => {
  LoggerFactory.setGlobalLogLevel(level);
};

export const setGlobalContext = (context: LogContext): void => {
  LoggerFactory.setGlobalContext(context);
};

// Default export for backward compatibility
export default LoggerFactory;
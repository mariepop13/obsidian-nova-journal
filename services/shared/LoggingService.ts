// Log level constants to avoid magic numbers
const LOG_LEVEL_ERROR = 0;
const LOG_LEVEL_WARN = 1;
const LOG_LEVEL_INFO = 2;
const LOG_LEVEL_DEBUG = 3;

export enum LogLevel {
  ERROR = LOG_LEVEL_ERROR,
  WARN = LOG_LEVEL_WARN,
  INFO = LOG_LEVEL_INFO,
  DEBUG = LOG_LEVEL_DEBUG,
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: string;
}

export class LoggingService {
  private static instance: LoggingService;
  private logLevel: LogLevel = LogLevel.ERROR;
  private isDebugMode = false;

  private constructor() {
    // Safe environment detection: only use process.env if defined, otherwise default to false.
    const processExists = typeof process !== 'undefined';
    const processEnvExists = processExists && typeof process.env !== 'undefined';
    const nodeEnv = processEnvExists ? process.env.NODE_ENV : undefined;
    this.isDebugMode = nodeEnv === 'development' || false;
    this.logLevel = this.isDebugMode ? LogLevel.DEBUG : LogLevel.ERROR;
  }

  static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  setDebugMode(enabled: boolean): void {
    this.isDebugMode = enabled;
    this.logLevel = enabled ? LogLevel.DEBUG : LogLevel.ERROR;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private createLogEntry(level: LogLevel, message: string, context?: string): LogEntry {
    return {
      level,
      message,
      timestamp: new Date(),
      context,
    };
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const levelStr = LogLevel[entry.level];
    const contextStr = entry.context ? ` [${entry.context}]` : '';
    return `${timestamp} ${levelStr}${contextStr}: ${entry.message}`;
  }

  error(message: string, context?: string): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const entry = this.createLogEntry(LogLevel.ERROR, message, context);
      // eslint-disable-next-line no-console
      console.error(this.formatMessage(entry));
    }
  }

  warn(message: string, context?: string): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const entry = this.createLogEntry(LogLevel.WARN, message, context);
      // eslint-disable-next-line no-console
      console.warn(this.formatMessage(entry));
    }
  }

  info(message: string, context?: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const entry = this.createLogEntry(LogLevel.INFO, message, context);
      // eslint-disable-next-line no-console
      console.info(this.formatMessage(entry));
    }
  }

  debug(message: string, context?: string): void {
    if (this.shouldLog(LogLevel.DEBUG) && this.isDebugMode) {
      const entry = this.createLogEntry(LogLevel.DEBUG, message, context);
      // eslint-disable-next-line no-console
      console.log(this.formatMessage(entry));
    }
  }
}

export const logger = LoggingService.getInstance();
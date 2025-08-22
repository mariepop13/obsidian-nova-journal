export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
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
    // Set log level based on environment
    this.isDebugMode = process.env.NODE_ENV === 'development';
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
      console.error(this.formatMessage(entry));
    }
  }

  warn(message: string, context?: string): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const entry = this.createLogEntry(LogLevel.WARN, message, context);
      console.warn(this.formatMessage(entry));
    }
  }

  info(message: string, context?: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const entry = this.createLogEntry(LogLevel.INFO, message, context);
      console.info(this.formatMessage(entry));
    }
  }

  debug(message: string, context?: string): void {
    if (this.shouldLog(LogLevel.DEBUG) && this.isDebugMode) {
      const entry = this.createLogEntry(LogLevel.DEBUG, message, context);
      console.log(this.formatMessage(entry));
    }
  }
}

export const logger = LoggingService.getInstance();
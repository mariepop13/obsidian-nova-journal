import { LoggingService, LogLevel, logger } from '../../services/shared/LoggingService';

describe('LoggingService', () => {
  let consoleSpy: {
    error: jest.SpyInstance;
    warn: jest.SpyInstance;
    info: jest.SpyInstance;
    log: jest.SpyInstance;
  };

  beforeEach(() => {
    consoleSpy = {
      error: jest.spyOn(console, 'error').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      info: jest.spyOn(console, 'info').mockImplementation(),
      log: jest.spyOn(console, 'log').mockImplementation(),
    };
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  describe('Environment Detection Safety', () => {
    test('should safely instantiate without process.env access errors', () => {
      // This test verifies the critical fix for unsafe process.env access
      expect(() => {
        const instance = LoggingService.getInstance();
        expect(instance).toBeInstanceOf(LoggingService);
      }).not.toThrow();
    });

    test('should handle undefined process safely', () => {
      // Mock undefined process to simulate browser/Obsidian environment
      const originalProcess = global.process;
      delete (global as any).process;
      
      expect(() => {
        // Force new instance creation
        (LoggingService as any).instance = undefined;
        const instance = LoggingService.getInstance();
        expect(instance).toBeInstanceOf(LoggingService);
      }).not.toThrow();
      
      // Restore original process
      global.process = originalProcess;
    });

    test('should handle undefined process.env safely', () => {
      // Mock process without env property
      const originalProcess = global.process;
      global.process = {} as any;
      
      expect(() => {
        // Force new instance creation
        (LoggingService as any).instance = undefined;
        const instance = LoggingService.getInstance();
        expect(instance).toBeInstanceOf(LoggingService);
      }).not.toThrow();
      
      // Restore original process
      global.process = originalProcess;
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance on multiple calls', () => {
      const instance1 = LoggingService.getInstance();
      const instance2 = LoggingService.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should provide global logger instance', () => {
      expect(logger).toBeInstanceOf(LoggingService);
      // The global logger should be the same type, but singleton might be reset in tests
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('Log Level Management', () => {
    let service: LoggingService;

    beforeEach(() => {
      service = LoggingService.getInstance();
    });

    test('should set and respect log levels', () => {
      service.setLogLevel(LogLevel.WARN);
      
      service.error('error message');
      service.warn('warn message');
      service.info('info message');
      
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('error message'));
      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('warn message'));
      expect(consoleSpy.info).not.toHaveBeenCalled();
    });

    test('should handle debug mode correctly', () => {
      service.setDebugMode(true);
      service.debug('debug message');
      
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('debug message'));
      
      service.setDebugMode(false);
      service.debug('debug message 2');
      
      expect(consoleSpy.log).toHaveBeenCalledTimes(1); // Should not call again
    });
  });

  describe('Message Formatting', () => {
    let service: LoggingService;

    beforeEach(() => {
      service = LoggingService.getInstance();
      service.setLogLevel(LogLevel.DEBUG);
    });

    test('should format messages with timestamp and level', () => {
      service.error('test error');
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z ERROR: test error$/)
      );
    });

    test('should include context in formatted messages', () => {
      service.warn('test warning', 'TestContext');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('[TestContext]: test warning')
      );
    });
  });

  describe('All Log Levels', () => {
    let service: LoggingService;

    beforeEach(() => {
      service = LoggingService.getInstance();
      service.setLogLevel(LogLevel.DEBUG);
      service.setDebugMode(true);
    });

    test('should log error messages', () => {
      service.error('error test', 'ErrorContext');
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('ERROR [ErrorContext]: error test')
      );
    });

    test('should log warn messages', () => {
      service.warn('warn test', 'WarnContext');
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('WARN [WarnContext]: warn test')
      );
    });

    test('should log info messages', () => {
      service.info('info test', 'InfoContext');
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('INFO [InfoContext]: info test')
      );
    });

    test('should log debug messages when debug mode enabled', () => {
      service.debug('debug test', 'DebugContext');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG [DebugContext]: debug test')
      );
    });
  });
});
import { LogLevel, LoggingService } from '../../services/shared/LoggingService';

// Type for accessing private static members in tests
interface LoggingServiceType {
  instance?: LoggingService;
}

// Type for global object manipulation in tests
interface TestableGlobal {
  process: NodeJS.Process | undefined;
}

// Mock console methods to capture logs
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Store original console methods
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
};

describe('LoggingService', () => {
  beforeEach(() => {
    // Replace console methods with mocks
    console.log = mockConsole.log;
    console.error = mockConsole.error;
    console.warn = mockConsole.warn;
    console.info = mockConsole.info;

    // Clear all mocks
    Object.values(mockConsole).forEach(mock => mock.mockClear());
    
    // Reset LoggingService instance for each test
    (LoggingService as unknown as LoggingServiceType).instance = undefined;
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
  });

  describe('Environment Safety', () => {
    test('should handle undefined process safely', () => {
      // Mock undefined process to simulate browser/Obsidian environment
      const originalProcess = global.process;
      (global as TestableGlobal).process = undefined;
      
      const testInstanceCreation = () => {
        // Force new instance creation
        (LoggingService as unknown as LoggingServiceType).instance = undefined;
        const instance = LoggingService.getInstance();
        expect(instance).toBeInstanceOf(LoggingService);
      };
      
      expect(testInstanceCreation).not.toThrow();
      
      // Restore original process
      global.process = originalProcess;
    });

    test('should handle undefined process.env safely', () => {
      // Mock process without env property
      const originalProcess = global.process;
      global.process = {} as unknown as NodeJS.Process;
      
      const testInstanceCreation = () => {
        // Force new instance creation
        (LoggingService as unknown as LoggingServiceType).instance = undefined;
        const instance = LoggingService.getInstance();
        expect(instance).toBeInstanceOf(LoggingService);
      };
      
      expect(testInstanceCreation).not.toThrow();
      
      // Restore original process
      global.process = originalProcess;
    });

    test('should handle development environment detection', () => {
      const originalProcess = global.process;
      global.process = {
        env: { NODE_ENV: 'development' }
      } as unknown as NodeJS.Process;
      
      // Force new instance creation
      (LoggingService as unknown as LoggingServiceType).instance = undefined;
      const instance = LoggingService.getInstance();
      
      // In development mode, debug messages should be logged
      instance.debug('Test debug message');
      expect(mockConsole.log).toHaveBeenCalled();
      
      // Restore original process
      global.process = originalProcess;
    });
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance', () => {
      const instance1 = LoggingService.getInstance();
      const instance2 = LoggingService.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should create instance if none exists', () => {
      const instance = LoggingService.getInstance();
      expect(instance).toBeInstanceOf(LoggingService);
    });
  });

  describe('Log Level Management', () => {
    let service: LoggingService;

    beforeEach(() => {
      service = LoggingService.getInstance();
    });

    test('should set log level correctly', () => {
      service.setLogLevel(LogLevel.INFO);
      
      service.info('Test info message');
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('INFO: Test info message')
      );
    });

    test('should respect log level filtering', () => {
      service.setLogLevel(LogLevel.ERROR);
      
      service.debug('Debug message');
      service.info('Info message');
      service.warn('Warning message');
      service.error('Error message');
      
      // debug
      expect(mockConsole.log).not.toHaveBeenCalled();
      // info
      expect(mockConsole.info).not.toHaveBeenCalled();
      // warn
      expect(mockConsole.warn).not.toHaveBeenCalled();
      // error
      expect(mockConsole.error).toHaveBeenCalled();
    });

    test('should handle debug mode toggle', () => {
      service.setDebugMode(true);
      
      service.debug('Debug message');
      expect(mockConsole.log).toHaveBeenCalled();
      
      service.setDebugMode(false);
      mockConsole.log.mockClear();
      
      service.debug('Debug message');
      expect(mockConsole.log).not.toHaveBeenCalled();
    });
  });

  describe('Logging Methods', () => {
    let service: LoggingService;

    beforeEach(() => {
      service = LoggingService.getInstance();
      // Enable all log levels for testing
      service.setLogLevel(LogLevel.DEBUG);
    });

    test('should log error messages', () => {
      service.error('Test error message');
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('ERROR: Test error message')
      );
    });

    test('should log warning messages', () => {
      service.warn('Test warning message');
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('WARN: Test warning message')
      );
    });

    test('should log info messages', () => {
      service.info('Test info message');
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('INFO: Test info message')
      );
    });

    test('should log debug messages', () => {
      // Enable debug mode for this test
      service.setDebugMode(true);
      service.debug('Test debug message');
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG: Test debug message')
      );
    });

    test('should include context when provided', () => {
      service.error('Test message', 'TestContext');
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[TestContext]: Test message')
      );
    });

    test('should include timestamp in log messages', () => {
      service.info('Test message');
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*INFO: Test message/)
      );
    });
  });

  describe('Performance and Edge Cases', () => {
    let service: LoggingService;

    beforeEach(() => {
      service = LoggingService.getInstance();
      service.setLogLevel(LogLevel.DEBUG);
    });

    test('should handle empty messages', () => {
      const logEmptyMessage = () => service.info('');
      expect(logEmptyMessage).not.toThrow();
      expect(mockConsole.info).toHaveBeenCalled();
    });

    test('should handle null/undefined messages gracefully', () => {
      const logNullMessage = () => service.info(null as unknown as string);
      const logUndefinedMessage = () => service.info(undefined as unknown as string);
      
      expect(logNullMessage).not.toThrow();
      expect(logUndefinedMessage).not.toThrow();
    });

    test('should handle special characters in messages', () => {
      const specialMessage = 'Message with 🚀 emoji and \n newlines';
      service.info(specialMessage);
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining(`INFO: ${  specialMessage}`)
      );
    });

    test('should handle very long messages', () => {
      const longMessage = 'x'.repeat(10000);
      const logLongMessage = () => service.info(longMessage);
      
      expect(logLongMessage).not.toThrow();
      expect(mockConsole.info).toHaveBeenCalled();
    });
  });
});

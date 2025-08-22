import { ToastSpinnerService } from '../../../services/editor/ToastSpinnerService';
import { Notice } from 'obsidian';

// Mock Notice since it's an Obsidian class
jest.mock('obsidian', () => {
  const MockNoticeConstructor = jest.fn().mockImplementation((message: string, timeout?: number) => {
    const instance = Object.create(MockNoticeConstructor.prototype);
    instance.message = message;
    instance.timeout = timeout;
    instance.hide = jest.fn();
    return instance;
  });

  return {
    Notice: MockNoticeConstructor,
  };
});

const MockNotice = Notice as jest.MockedClass<typeof Notice>;

describe('ToastSpinnerService Simple Methods', () => {
  beforeEach(() => {
    MockNotice.mockClear();
  });

  describe('notice()', () => {
    it('should create a Notice with custom markup', () => {
      const message = 'Test notice';
      ToastSpinnerService.notice(message);

      expect(MockNotice).toHaveBeenCalledWith('', 5000);
      expect(MockNotice).toHaveBeenCalledTimes(1);
    });

    it('should create a Notice with custom timeout', () => {
      const message = 'Test notice';
      const timeout = 5000;
      ToastSpinnerService.notice(message, timeout);

      expect(MockNotice).toHaveBeenCalledWith('', timeout);
      expect(MockNotice).toHaveBeenCalledTimes(1);
    });
  });

  describe('warn()', () => {
    it('should create a Notice for warning', () => {
      const message = 'Warning message';
      ToastSpinnerService.warn(message);

      expect(MockNotice).toHaveBeenCalledWith('', 5000);
      expect(MockNotice).toHaveBeenCalledTimes(1);
    });

    it('should create a Notice for warning with timeout', () => {
      const message = 'Warning message';
      const timeout = 3000;
      ToastSpinnerService.warn(message, timeout);

      expect(MockNotice).toHaveBeenCalledWith('', timeout);
      expect(MockNotice).toHaveBeenCalledTimes(1);
    });
  });

  describe('error()', () => {
    it('should create a Notice for error', () => {
      const message = 'Error message';
      ToastSpinnerService.error(message);

      expect(MockNotice).toHaveBeenCalledWith('', 5000);
      expect(MockNotice).toHaveBeenCalledTimes(1);
    });

    it('should create a Notice for error with timeout', () => {
      const message = 'Error message';
      const timeout = 8000;
      ToastSpinnerService.error(message, timeout);

      expect(MockNotice).toHaveBeenCalledWith('', timeout);
      expect(MockNotice).toHaveBeenCalledTimes(1);
    });
  });

  describe('info()', () => {
    it('should create a Notice for info', () => {
      const message = 'Info message';
      ToastSpinnerService.info(message);

      expect(MockNotice).toHaveBeenCalledWith('', 5000);
      expect(MockNotice).toHaveBeenCalledTimes(1);
    });

    it('should create a Notice for info with timeout', () => {
      const message = 'Info message';
      const timeout = 4000;
      ToastSpinnerService.info(message, timeout);

      expect(MockNotice).toHaveBeenCalledWith('', timeout);
      expect(MockNotice).toHaveBeenCalledTimes(1);
    });
  });

  describe('return values', () => {
    it('should return Notice instance from all methods', () => {
      const message = 'Test message';

      const notice1 = ToastSpinnerService.notice(message);
      const notice2 = ToastSpinnerService.warn(message);
      const notice3 = ToastSpinnerService.error(message);
      const notice4 = ToastSpinnerService.info(message);

      expect(notice1).toBeInstanceOf(MockNotice);
      expect(notice2).toBeInstanceOf(MockNotice);
      expect(notice3).toBeInstanceOf(MockNotice);
      expect(notice4).toBeInstanceOf(MockNotice);
    });
  });
});

import { Notice } from 'obsidian';
import { LoadingSpinnerService, type LoadingState, type SpinnerInstance } from './LoadingSpinnerService';

export interface ToastSpinnerConfig {
  message: string;
  state?: LoadingState;
  timeout?: number;
  showSpinner?: boolean;
  spinnerPosition?: 'left' | 'right';
  autoHide?: boolean;
}

export interface ToastSpinnerInstance {
  id: string;
  notice: Notice;
  spinner?: SpinnerInstance;
  config: ToastSpinnerConfig;
  updateMessage: (message: string) => void;
  updateState: (state: LoadingState) => void;
  hide: () => void;
}

export class ToastSpinnerService {
  private static activeToasts = new Map<string, ToastSpinnerInstance>();
  private static idCounter = 0;

  private static generateId(): string {
    return `nova-toast-${++this.idCounter}-${Date.now()}`;
  }

  static create(config: ToastSpinnerConfig): ToastSpinnerInstance {
    const id = this.generateId();
    const {
      message,
      state = 'loading',
      timeout = 0,
      showSpinner = true,
      spinnerPosition = 'left',
      autoHide = false
    } = config;

    // Create notice container
    const noticeElement = this.createNoticeElement(message, showSpinner, state, spinnerPosition);
    const notice = new Notice('', timeout);
    
    if ((notice as any).noticeEl) {
      const noticeEl = (notice as any).noticeEl as HTMLElement;
      while (noticeEl.firstChild) {
        noticeEl.removeChild(noticeEl.firstChild);
      }
      noticeEl.appendChild(noticeElement);
    } else {
      document.body.appendChild(noticeElement);
    }

    // Create spinner if requested
    let spinner: SpinnerInstance | undefined;
    if (showSpinner) {
      spinner = LoadingSpinnerService.create({
        text: '',
        state,
        size: 'small',
        position: 'inline'
      });
      
      const spinnerContainer = noticeElement.querySelector('.nova-toast-spinner') as HTMLElement;
      if (spinnerContainer && spinner.element) {
        spinnerContainer.appendChild(spinner.element);
      }
    }

    const instance: ToastSpinnerInstance = {
      id,
      notice,
      spinner,
      config,
      updateMessage: (newMessage: string) => this.updateMessage(id, newMessage),
      updateState: (newState: LoadingState) => this.updateState(id, newState),
      hide: () => this.hide(id)
    };

    this.activeToasts.set(id, instance);

    // Auto-hide if configured
    if (autoHide && timeout > 0) {
      setTimeout(() => this.hide(id), timeout);
    }

    return instance;
  }

  static hide(id: string): void {
    const toast = this.activeToasts.get(id);
    if (toast) {
      toast.notice.hide();
      if (toast.spinner) {
        toast.spinner.destroy();
      }
      this.activeToasts.delete(id);
    }
  }

  static hideAll(): void {
    for (const [id] of this.activeToasts) {
      this.hide(id);
    }
  }

  private static updateMessage(id: string, message: string): void {
    const toast = this.activeToasts.get(id);
    if (toast) {
      const noticeEl = (toast.notice as any).noticeEl as HTMLElement;
      const messageElement = noticeEl?.querySelector('.nova-toast-message') as HTMLElement;
      if (messageElement) {
        messageElement.textContent = message;
      }
    }
  }

  private static updateState(id: string, state: LoadingState): void {
    const toast = this.activeToasts.get(id);
    if (toast && toast.spinner) {
      LoadingSpinnerService.updateState(toast.spinner.id, state);
      toast.config.state = state;
    }
  }


  private static createNoticeElement(
    message: string,
    showSpinner: boolean,
    _state: LoadingState,
    spinnerPosition: 'left' | 'right'
  ): HTMLElement {
    const container = document.createElement('div');
    container.className = 'nova-toast-container';

    if (showSpinner && spinnerPosition === 'left') {
      const spinnerContainer = document.createElement('div');
      spinnerContainer.className = 'nova-toast-spinner nova-toast-spinner-left';
      container.appendChild(spinnerContainer);
    }

    const messageElement = document.createElement('span');
    messageElement.className = 'nova-toast-message';
    messageElement.textContent = message;
    container.appendChild(messageElement);

    if (showSpinner && spinnerPosition === 'right') {
      const spinnerContainer = document.createElement('div');
      spinnerContainer.className = 'nova-toast-spinner nova-toast-spinner-right';
      container.appendChild(spinnerContainer);
    }

    return container;
  }

  // Convenience methods for common patterns
  static showLoading(message: string, state: LoadingState = 'loading'): ToastSpinnerInstance {
    return this.create({
      message,
      state,
      showSpinner: true,
      spinnerPosition: 'left'
    });
  }

  static showThinking(message: string = 'Thinking...'): ToastSpinnerInstance {
    return this.create({
      message,
      state: 'thinking',
      showSpinner: true,
      spinnerPosition: 'left'
    });
  }

  static showGenerating(message: string = 'Generating...'): ToastSpinnerInstance {
    return this.create({
      message,
      state: 'generating',
      showSpinner: true,
      spinnerPosition: 'left'
    });
  }

  static showProcessing(message: string = 'Processing...'): ToastSpinnerInstance {
    return this.create({
      message,
      state: 'processing',
      showSpinner: true,
      spinnerPosition: 'left'
    });
  }

  static showAnalyzing(message: string = 'Analyzing...'): ToastSpinnerInstance {
    return this.create({
      message,
      state: 'analyzing',
      showSpinner: true,
      spinnerPosition: 'left'
    });
  }


  static notice(message: string, timeout?: number): Notice {
    const instance = this.create({
      message,
      showSpinner: false,
      timeout: timeout || 4000,
      autoHide: true
    });
    return instance.notice;
  }

  static warn(message: string, timeout?: number): Notice {
    const instance = this.create({
      message,
      showSpinner: false,
      timeout: timeout || 4000,
      autoHide: true
    });
    
    const noticeEl = (instance.notice as any).noticeEl as HTMLElement;
    if (noticeEl && noticeEl.classList) {
      noticeEl.classList.add('nova-toast-warn');
    }
    
    return instance.notice;
  }

  static error(message: string, timeout?: number): Notice {
    const instance = this.create({
      message,
      showSpinner: false,
      timeout: timeout || 5000,
      autoHide: true
    });
    
    const noticeEl = (instance.notice as any).noticeEl as HTMLElement;
    if (noticeEl && noticeEl.classList) {
      noticeEl.classList.add('nova-toast-error');
    }
    
    return instance.notice;
  }

  static info(message: string, timeout?: number): Notice {
    const instance = this.create({
      message,
      showSpinner: false,
      timeout: timeout || 4000,
      autoHide: true
    });
    
    const noticeEl = (instance.notice as any).noticeEl as HTMLElement;
    if (noticeEl && noticeEl.classList) {
      noticeEl.classList.add('nova-toast-info');
    }
    
    return instance.notice;
  }

  static async withProgress<T>(
    operation: (toast: ToastSpinnerInstance) => Promise<T>,
    config: {
      loadingMessage: string;
      loadingState?: LoadingState;
      successMessage?: string;
      errorMessage?: string;
    }
  ): Promise<T> {
    const {
      loadingMessage,
      loadingState = 'processing',
      successMessage,
      errorMessage
    } = config;

    const toast = this.create({
      message: loadingMessage,
      state: loadingState,
      showSpinner: true,
      spinnerPosition: 'left'
    });

    try {
      const result = await operation(toast);
      
      if (successMessage) {
        toast.hide();
        this.notice(successMessage, 3000);
      } else {
        toast.hide();
      }
      
      return result;
    } catch (error) {
      const finalErrorMessage = errorMessage || 
        (error instanceof Error ? error.message : 'Operation failed');
      toast.hide();
      this.error(finalErrorMessage, 5000);
      throw error;
    }
  }
}

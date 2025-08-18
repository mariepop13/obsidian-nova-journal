export interface LoadingSpinnerConfig {
  text?: string;
  state?: LoadingState;
  size?: SpinnerSize;
  position?: SpinnerPosition;
  duration?: number;
}

export type LoadingState = 'thinking' | 'generating' | 'processing' | 'analyzing' | 'loading';
export type SpinnerSize = 'small' | 'medium' | 'large';
export type SpinnerPosition = 'inline' | 'overlay' | 'modal';

export interface SpinnerInstance {
  element: HTMLElement;
  id: string;
  config: LoadingSpinnerConfig;
  destroy(): void;
}

export class LoadingSpinnerService {
  private static activeSpinners = new Map<string, SpinnerInstance>();
  private static idCounter = 0;

  private static generateId(): string {
    return `nova-spinner-${++this.idCounter}-${Date.now()}`;
  }

  static create(config: LoadingSpinnerConfig = {}): SpinnerInstance {
    const id = this.generateId();
    const element = this.createSpinnerElement(config);

    const instance: SpinnerInstance = {
      element,
      id,
      config,
      destroy: () => this.destroy(id),
    };

    this.activeSpinners.set(id, instance);
    return instance;
  }

  static destroy(id: string): void {
    const spinner = this.activeSpinners.get(id);
    if (spinner) {
      spinner.element.remove();
      this.activeSpinners.delete(id);
    }
  }

  static destroyAll(): void {
    for (const [id] of this.activeSpinners) {
      this.destroy(id);
    }
  }

  static updateText(id: string, text: string): void {
    const spinner = this.activeSpinners.get(id);
    if (spinner) {
      const textElement = spinner.element.querySelector('.nova-spinner-text');
      if (textElement) {
        textElement.textContent = text;
      }
    }
  }

  static updateState(id: string, state: LoadingState): void {
    const spinner = this.activeSpinners.get(id);
    if (spinner) {
      // Remove old state classes
      spinner.element.classList.remove(
        'nova-spinner-thinking',
        'nova-spinner-generating',
        'nova-spinner-processing',
        'nova-spinner-analyzing',
        'nova-spinner-loading'
      );

      // Add new state class
      spinner.element.classList.add(`nova-spinner-${state}`);
      spinner.config.state = state;
    }
  }

  private static createSpinnerElement(config: LoadingSpinnerConfig): HTMLElement {
    const { text = '', state = 'loading', size = 'medium', position = 'inline' } = config;

    const container = document.createElement('div');
    container.className = this.buildSpinnerClasses(state, size, position);

    // Create spinner animation element
    const spinner = document.createElement('div');
    spinner.className = 'nova-spinner-animation';

    // Create dots for the animation
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.className = `nova-spinner-dot nova-spinner-dot-${i + 1}`;
      spinner.appendChild(dot);
    }

    container.appendChild(spinner);

    // Add text if provided
    if (text) {
      const textElement = document.createElement('span');
      textElement.className = 'nova-spinner-text';
      textElement.textContent = text;
      container.appendChild(textElement);
    }

    return container;
  }

  private static buildSpinnerClasses(state: LoadingState, size: SpinnerSize, position: SpinnerPosition): string {
    return ['nova-spinner', `nova-spinner-${state}`, `nova-spinner-${size}`, `nova-spinner-${position}`].join(' ');
  }

  static attachToElement(element: HTMLElement, config: LoadingSpinnerConfig = {}): SpinnerInstance {
    const spinner = this.create(config);

    if (config.position === 'overlay') {
      // Create overlay container
      const overlay = document.createElement('div');
      overlay.className = 'nova-spinner-overlay-container';
      overlay.style.position = 'relative';

      // Wrap the target element
      const parent = element.parentNode;
      if (parent) {
        parent.insertBefore(overlay, element);
        overlay.appendChild(element);
        overlay.appendChild(spinner.element);
      }
    } else {
      // Inline attachment
      element.appendChild(spinner.element);
    }

    return spinner;
  }

  static createInlineSpinner(text: string, state: LoadingState = 'loading'): HTMLElement {
    const spinner = this.create({
      text,
      state,
      size: 'small',
      position: 'inline',
    });
    return spinner.element;
  }

  static createModalSpinner(text: string, state: LoadingState = 'processing'): HTMLElement {
    const spinner = this.create({
      text,
      state,
      size: 'large',
      position: 'modal',
    });
    return spinner.element;
  }

  static getStateText(state: LoadingState): string {
    const stateTexts: Record<LoadingState, string> = {
      thinking: 'Thinking...',
      generating: 'Generating...',
      processing: 'Processing...',
      analyzing: 'Analyzing...',
      loading: 'Loading...',
    };
    return stateTexts[state];
  }
}

import { DateFormatter } from '../settings/PluginSettings';
import { TEMPLATE_PATTERNS } from './Constants';

export interface TemplateContext {
  prompt: string;
  date: Date;
  userName: string;
  aiEnabled: boolean;
}

export interface RenderConfig {
  basePrompt: string;
  date: Date;
  addSectionHeading: boolean;
  sectionHeading: string;
  promptTemplate: string;
  userName: string;
  aiEnabled: boolean;
}

export class PromptRenderingService {
  static renderFinalPrompt(config: RenderConfig): string {
    const heading = config.addSectionHeading && config.sectionHeading
      ? `${config.sectionHeading}\n\n`
      : '';

    const template = (config.promptTemplate || '').trim();
    if (template.length > 0) {
      const rendered = this.renderTemplate(template, {
        prompt: config.basePrompt,
        date: config.date,
        userName: config.userName,
        aiEnabled: config.aiEnabled
      });
      return `${heading}${rendered}\n`;
    }
    
    return `${heading}${config.basePrompt}\n`;
  }

  static checkForDuplicatePrompt(
    noteText: string,
    basePrompt: string
  ): boolean {
    return noteText.includes(basePrompt);
  }

  static generateDuplicateMarker(_date: Date): string { return ''; }

  private static renderTemplate(template: string, context: TemplateContext): string {
    let output = template.replace(TEMPLATE_PATTERNS.PROMPT, context.prompt);
    
    output = output.replace(TEMPLATE_PATTERNS.DATE, (_match, format) => {
      const dateFormat = typeof format === 'string' ? format.trim() : 'YYYY-MM-DD';
      return DateFormatter.format(context.date, dateFormat);
    });

    if (context.aiEnabled) {
      const userLine = `**${context.userName || 'You'}** (you): `;
      output = output.replace(TEMPLATE_PATTERNS.USER_LINE, userLine);
    } else {
      output = this.cleanNonAIContent(output);
    }

    return output.replace(TEMPLATE_PATTERNS.MULTIPLE_NEWLINES, '\n\n').trimEnd();
  }

  private static cleanNonAIContent(content: string): string {
    return content
      .replace(TEMPLATE_PATTERNS.USER_LINE, '')
      .replace(/^\s*\*\*Nova\*\*:\s*/gm, '')
      .replace(/<a[^>]*class="nova-deepen"[^>]*>.*?<\/a>\s*/g, '');
  }
}

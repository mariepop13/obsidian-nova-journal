import { DateFormatter } from '../settings/PluginSettings';

export interface TemplateContext {
  prompt: string;
  date: Date;
  userName: string;
  aiEnabled: boolean;
}

export class PromptRenderingService {
  static renderFinalPrompt(
    basePrompt: string,
    date: Date,
    addSectionHeading: boolean,
    sectionHeading: string,
    promptTemplate: string,
    userName: string,
    aiEnabled: boolean
  ): string {
    const heading = addSectionHeading && sectionHeading
      ? `${sectionHeading}\n\n`
      : '';

    const template = (promptTemplate || '').trim();
    if (template.length > 0) {
      const rendered = this.renderTemplate(template, {
        prompt: basePrompt,
        date,
        userName,
        aiEnabled
      });
      return `${heading}${rendered}\n`;
    }
    
    return `${heading}${basePrompt}\n`;
  }

  static checkForDuplicatePrompt(
    noteText: string,
    basePrompt: string,
    date: Date,
    useDuplicateMarker: boolean
  ): boolean {
    if (useDuplicateMarker) {
      const todayMarker = `<!-- nova:prompt:${DateFormatter.format(date, 'YYYY-MM-DD')} -->`;
      return noteText.includes(todayMarker);
    }
    
    return noteText.includes(basePrompt);
  }

  static generateDuplicateMarker(date: Date): string {
    return `\n<!-- nova:prompt:${DateFormatter.format(date, 'YYYY-MM-DD')} -->\n`;
  }

  private static renderTemplate(template: string, context: TemplateContext): string {
    let output = template.replace(/\{\{\s*prompt\s*\}\}/g, context.prompt);
    
    output = output.replace(/\{\{\s*date(?::([^}]+))?\s*\}\}/g, (_match, format) => {
      const dateFormat = typeof format === 'string' ? format.trim() : 'YYYY-MM-DD';
      return DateFormatter.format(context.date, dateFormat);
    });

    if (context.aiEnabled) {
      const userLine = `**${context.userName || 'You'}** (you): `;
      output = output.replace(/\{\{\s*user_line\s*\}\}/g, userLine);
    } else {
      output = this.cleanNonAIContent(output);
    }

    return output.replace(/\n{3,}/g, '\n\n').trimEnd();
  }

  private static cleanNonAIContent(content: string): string {
    return content
      .replace(/\{\{\s*user_line\s*\}\}/g, '')
      .replace(/^\s*\*\*Nova\*\*:\s*/gm, '')
      .replace(/<a[^>]*class="nova-deepen"[^>]*>.*?<\/a>\s*/g, '');
  }
}

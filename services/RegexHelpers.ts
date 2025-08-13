import { CSS_CLASSES, REGEX_PATTERNS } from './Constants';

export class RegexHelpers {
  static createButtonClassRegex(className: string): RegExp {
    const escapedClass = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = `<(a|button)\\b[^>]*class=("[^"]*\\b${escapedClass}\\b[^"]*"|'[^']*\\b${escapedClass}\\b[^']*')[^>]*>`;
    return new RegExp(pattern, 'i');
  }

  static createHeadingRegex(headingName?: string): RegExp {
    if (!headingName?.trim()) {
      return REGEX_PATTERNS.HEADING;
    }

    const escapedHeading = headingName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = `^\\s*#{1,6}\\s*${escapedHeading}\\s*$`;
    return new RegExp(pattern, 'i');
  }

  static hasClassInTag(line: string, className: string): boolean {
    const regex = this.createButtonClassRegex(className);
    return regex.test(line);
  }

  static isDeepenButtonMarkup(line: string): boolean {
    return this.hasClassInTag(line, CSS_CLASSES.NOVA_DEEPEN);
  }

  static isMoodAnalyzeButtonMarkup(line: string): boolean {
    return this.hasClassInTag(line, CSS_CLASSES.NOVA_MOOD_ANALYZE);
  }

  static isNoteScopedDeepenMarkup(line: string): boolean {
    return this.isDeepenButtonMarkup(line) && /data-scope=("|')note\1/i.test(line);
  }

  static isDateHeading(line: string): boolean {
    return REGEX_PATTERNS.DATE_HEADING.test(line.trim());
  }

  static isSpeakerLine(line: string): boolean {
    return REGEX_PATTERNS.SPEAKER_LINE.test(line);
  }

  static isBlankLine(line: string): boolean {
    return line.trim().length === 0;
  }

  static isAnchorMarkup(line: string): boolean {
    return this.isDeepenButtonMarkup(line) || this.isMoodAnalyzeButtonMarkup(line);
  }

  static createDeepenButtonPattern(lineNumber: number): RegExp {
    const pattern = `^<a[^>]*class="nova-deepen"[^>]*data-line="${lineNumber}"[^>]*>.*</a>$`;
    return new RegExp(pattern);
  }

  static createNoteScopeAnchorPattern(): RegExp {
    const pattern = '(<(a|button))\\b[^>]*class=("[^"]*\\bnova-deepen\\b[^"]*"|\'[^\']*\\bnova-deepen\\b[^\']*\')[^>]*data-scope=("|')note\\4';
    return new RegExp(pattern);
  }

  static createGeneralDeepenPattern(): RegExp {
    const pattern = '<(a|button)\\b[^>]*class=("[^"]*\\bnova-deepen\\b[^"]*"|\'[^\']*\\bnova-deepen\\b[^\']*\')[^>]*>';
    return new RegExp(pattern);
  }
}

import { TIME_CONSTANTS, PARSING_CONSTANTS } from '../shared/Constants';

export class TemporalUtils {
  static extractDateFromFilename(filename: string): number | null {
    // Support format YYYY-MM-DD_HH-ss or YYYY-MM-DD
    const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})(?:_(\d{2})-(\d{2}))?/);
    if (!dateMatch) return null;

    const datePart = dateMatch[PARSING_CONSTANTS.REGEX_MATCH_DATE_INDEX];
    const hourPart = dateMatch[PARSING_CONSTANTS.REGEX_MATCH_HOUR_INDEX] ?? TIME_CONSTANTS.DEFAULT_HOUR;
    const minutePart = dateMatch[PARSING_CONSTANTS.REGEX_MATCH_MINUTE_INDEX] ?? TIME_CONSTANTS.DEFAULT_MINUTE;

    const date = new Date(`${datePart}T${hourPart}:${minutePart}:${TIME_CONSTANTS.DEFAULT_SECOND}`);
    return isNaN(date.getTime()) ? null : date.getTime();
  }

  static formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / TIME_CONSTANTS.MS_PER_DAY);

    if (diffDays === TIME_CONSTANTS.TIME_AGO_DAYS_MIN) return "aujourd'hui";
    if (diffDays === TIME_CONSTANTS.TIME_AGO_DAYS_ONE) return 'hier';
    if (diffDays < TIME_CONSTANTS.DAYS_IN_WEEK) return `il y a ${diffDays} jours`;
    if (diffDays < TIME_CONSTANTS.DAYS_IN_MONTH) return `il y a ${Math.floor(diffDays / TIME_CONSTANTS.DAYS_IN_WEEK)} semaines`;
    return date.toLocaleDateString('fr-FR', {
      month: 'long',
      day: 'numeric',
    });
  }

  static getTimeRangeForFrame(timeFrame: 'recent' | 'week' | 'month'): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;

    switch (timeFrame) {
      case 'recent':
        start = new Date(now.getTime() - TIME_CONSTANTS.RECENT_DAYS_LIMIT * TIME_CONSTANTS.MS_PER_DAY);
        break;
      case 'week':
        start = new Date(now.getTime() - TIME_CONSTANTS.WEEK_DAYS_LIMIT * TIME_CONSTANTS.MS_PER_DAY);
        break;
      case 'month':
        start = new Date(now.getTime() - TIME_CONSTANTS.MONTH_DAYS_LIMIT * TIME_CONSTANTS.MS_PER_DAY);
        break;
    }

    return { start, end: now };
  }
}

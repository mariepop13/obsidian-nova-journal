export class TemporalUtils {
  static extractDateFromFilename(filename: string): number | null {
    // Support format YYYY-MM-DD_HH-ss or YYYY-MM-DD
    const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})(?:_(\d{2})-(\d{2}))?/);
    if (!dateMatch) return null;

    const datePart = dateMatch[1];
    const hourPart = dateMatch[2] || '00';
    const minutePart = dateMatch[3] || '00';
    
    const date = new Date(`${datePart}T${hourPart}:${minutePart}:00`);
    return isNaN(date.getTime()) ? null : date.getTime();
  }

  static formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "aujourd'hui";
    if (diffDays === 1) return "hier";
    if (diffDays < 7) return `il y a ${diffDays} jours`;
    if (diffDays < 30) return `il y a ${Math.floor(diffDays / 7)} semaines`;
    return date.toLocaleDateString("fr-FR", {
      month: "long",
      day: "numeric",
    });
  }

  static getTimeRangeForFrame(timeFrame: 'recent' | 'week' | 'month'): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    
    switch (timeFrame) {
      case 'recent':
        start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        break;
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    return { start, end: now };
  }
}

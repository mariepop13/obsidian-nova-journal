import type { ContextType } from './EnhancedEmbeddingService';

const EMOTIONAL_WORDS = [
  'feel', 'felt', 'emotion', 'mood', 'happy', 'sad', 'angry', 'frustrated', 
  'excited', 'anxious', 'calm', 'stressed', 'peaceful', 'worried', 'hopeful', 
  'disappointed', 'grateful', 'proud', 'embarrassed', 'confused', 'overwhelmed',
  'content', 'joy', 'fear', 'love', 'hate', 'surprise', 'disgust', 'trust', 'anticipation'
];

const TEMPORAL_WORDS = [
  'today', 'yesterday', 'tomorrow', 'this week', 'last week', 'next week', 
  'this month', 'last month', 'recently', 'soon', 'now', 'then', 'when', 
  'during', 'after', 'before', 'while', 'since', 'until', 'ago', 'later'
];

const THEMATIC_WORDS = [
  'work', 'job', 'career', 'family', 'friends', 'health', 'fitness', 'travel',
  'hobby', 'project', 'goal', 'plan', 'study', 'learn', 'relationship', 'love',
  'home', 'money', 'finance', 'food', 'exercise', 'book', 'movie', 'music', 'art', 'creative'
];

export class ContextAnalyzer {
  private createContextScores(text: string) {
    const emotionalKeywords = new RegExp(`\\b(${EMOTIONAL_WORDS.join('|')})\\b`, 'i');
    const temporalKeywords = new RegExp(`\\b(${TEMPORAL_WORDS.join('|')})\\b`, 'i');
    const thematicKeywords = new RegExp(`\\b(${THEMATIC_WORDS.join('|')})\\b`, 'i');

    const emotionalMatches = text.match(new RegExp(emotionalKeywords.source, 'gi')) ?? [];
    const temporalMatches = text.match(new RegExp(temporalKeywords.source, 'gi')) ?? [];
    const thematicMatches = text.match(new RegExp(thematicKeywords.source, 'gi')) ?? [];

    return {
      emotional: emotionalMatches.length,
      temporal: temporalMatches.length,
      thematic: thematicMatches.length,
    };
  }

  determineContextType(text: string): ContextType {
    const scores = this.createContextScores(text);
    const maxScore = Math.max(scores.emotional, scores.temporal, scores.thematic);

    if (maxScore === 0) return 'general';

    if (scores.emotional === maxScore) return 'emotional';
    if (scores.temporal === maxScore) return 'temporal';
    if (scores.thematic === maxScore) return 'thematic';

    return 'general';
  }

  private getEmotionMap(): Record<string, string[]> {
    return {
      positive: ['happy', 'excited', 'calm', 'peaceful', 'hopeful', 'grateful', 'proud', 'content', 'joy', 'love'],
      negative: [
        'sad', 'angry', 'frustrated', 'anxious', 'stressed', 'worried',
        'disappointed', 'embarrassed', 'overwhelmed', 'fear', 'hate',
      ],
      neutral: ['confused', 'surprised', 'curious', 'interested'],
    };
  }

  extractEmotionalTags(text: string): string[] {
    const emotionMap = this.getEmotionMap();
    const found: string[] = [];
    const lowerText = text.toLowerCase();

    for (const [category, emotions] of Object.entries(emotionMap)) {
      for (const emotion of emotions) {
        if (lowerText.includes(emotion)) {
          found.push(category);
          break;
        }
      }
    }

    return [...new Set(found)];
  }

  private getThemeMap(): Record<string, string[]> {
    return {
      work: ['work', 'job', 'career', 'office', 'meeting', 'project', 'colleague', 'boss', 'deadline'],
      personal: ['family', 'friends', 'relationship', 'love', 'home', 'personal'],
      health: ['health', 'fitness', 'exercise', 'doctor', 'wellness', 'sleep', 'tired'],
      learning: ['study', 'learn', 'book', 'course', 'education', 'knowledge', 'skill'],
      creativity: ['art', 'creative', 'music', 'write', 'paint', 'design', 'create'],
      leisure: ['hobby', 'travel', 'movie', 'game', 'fun', 'vacation', 'relax'],
    };
  }

  extractThematicTags(text: string): string[] {
    const themeMap = this.getThemeMap();
    const found: string[] = [];
    const lowerText = text.toLowerCase();

    for (const [theme, keywords] of Object.entries(themeMap)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        found.push(theme);
      }
    }

    return [...new Set(found)];
  }

  extractTemporalMarkers(text: string): string[] {
    const timePatterns = [
      /\b(today|yesterday|tomorrow)\b/gi,
      /\b(this|last|next)\s+(week|month|year)\b/gi,
      /\b(\d{1,2}:\d{2})\b/g,
      /\b(morning|afternoon|evening|night)\b/gi,
      /\b(\d{1,2})\s+(days?|weeks?|months?)\s+ago\b/gi,
    ];

    const found: string[] = [];

    for (const pattern of timePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        found.push(...matches.map(m => m.toLowerCase()));
      }
    }

    return [...new Set(found)];
  }
}

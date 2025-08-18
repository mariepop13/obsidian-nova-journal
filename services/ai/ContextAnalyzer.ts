import type { ContextType } from './EnhancedEmbeddingService';

export class ContextAnalyzer {
  determineContextType(text: string): ContextType {
    const emotionalKeywords =
      /\b(feel|felt|emotion|mood|happy|sad|angry|frustrated|excited|anxious|calm|stressed|peaceful|worried|hopeful|disappointed|grateful|proud|embarrassed|confused|overwhelmed|content|joy|fear|love|hate|surprise|disgust|trust|anticipation)\b/i;
    const temporalKeywords =
      /\b(today|yesterday|tomorrow|this week|last week|next week|this month|last month|recently|soon|now|then|when|during|after|before|while|since|until|ago|later)\b/i;
    const thematicKeywords =
      /\b(work|job|career|family|friends|health|fitness|travel|hobby|project|goal|plan|study|learn|relationship|love|home|money|finance|food|exercise|book|movie|music|art|creative)\b/i;

    const scores = {
      emotional: 0,
      temporal: 0,
      thematic: 0,
    };

    const emotionalMatches = text.match(new RegExp(emotionalKeywords.source, 'gi')) || [];
    const temporalMatches = text.match(new RegExp(temporalKeywords.source, 'gi')) || [];
    const thematicMatches = text.match(new RegExp(thematicKeywords.source, 'gi')) || [];

    scores.emotional = emotionalMatches.length;
    scores.temporal = temporalMatches.length;
    scores.thematic = thematicMatches.length;

    const maxScore = Math.max(scores.emotional, scores.temporal, scores.thematic);

    if (maxScore === 0) return 'general';

    if (scores.emotional === maxScore) return 'emotional';
    if (scores.temporal === maxScore) return 'temporal';
    if (scores.thematic === maxScore) return 'thematic';

    return 'general';
  }

  extractEmotionalTags(text: string): string[] {
    const emotionMap: Record<string, string[]> = {
      positive: ['happy', 'excited', 'calm', 'peaceful', 'hopeful', 'grateful', 'proud', 'content', 'joy', 'love'],
      negative: [
        'sad',
        'angry',
        'frustrated',
        'anxious',
        'stressed',
        'worried',
        'disappointed',
        'embarrassed',
        'overwhelmed',
        'fear',
        'hate',
      ],
      neutral: ['confused', 'surprised', 'curious', 'interested'],
    };

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

  extractThematicTags(text: string): string[] {
    const themeMap: Record<string, string[]> = {
      work: ['work', 'job', 'career', 'office', 'meeting', 'project', 'colleague', 'boss', 'deadline'],
      personal: ['family', 'friends', 'relationship', 'love', 'home', 'personal'],
      health: ['health', 'fitness', 'exercise', 'doctor', 'wellness', 'sleep', 'tired'],
      learning: ['study', 'learn', 'book', 'course', 'education', 'knowledge', 'skill'],
      creativity: ['art', 'creative', 'music', 'write', 'paint', 'design', 'create'],
      leisure: ['hobby', 'travel', 'movie', 'game', 'fun', 'vacation', 'relax'],
    };

    const found: string[] = [];
    const lowerText = text.toLowerCase();

    for (const [theme, keywords] of Object.entries(themeMap)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          found.push(theme);
          break;
        }
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

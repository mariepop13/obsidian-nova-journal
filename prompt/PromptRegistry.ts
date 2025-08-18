export type PromptStyle = 'reflective' | 'gratitude' | 'planning' | 'dreams';

export const promptPacks: Record<PromptStyle, string[]> = {
  reflective: [
    'What did I learn today that I want to remember?',
    'Which moment felt most meaningful and why?',
    'What challenged me today and how did I respond?',
    'What is one small win I am proud of today?',
  ],
  gratitude: [
    'List three things I am grateful for today and why they matter.',
    'Who am I grateful for today, and what did they do?',
    'Which simple comfort improved my day?',
    'What positive surprise did I notice today?',
  ],
  planning: [
    'What is the single most important task for tomorrow?',
    'Which obstacle might block me, and how will I handle it?',
    'What one habit will I reinforce tomorrow?',
    'What would make tomorrow feel successful?',
  ],
  dreams: [
    'Describe the most vivid part of your dream and how it felt.',
    'What symbols or recurring themes appeared in your dream?',
    'If this dream was telling you something, what might it be?',
    'What emotions linger from the dream as you wake up?',
  ],
};

import { RegexHelpers } from '../utils/RegexHelpers';
import { HASH_CONSTANTS } from '../shared/Constants';

export function generateAnchorId(): string {
  const rnd = Math.random().toString(HASH_CONSTANTS.BASE_36).slice(HASH_CONSTANTS.RANDOM_STRING_START, HASH_CONSTANTS.RANDOM_STRING_START + HASH_CONSTANTS.RANDOM_STRING_LENGTH);
  return `conv-${Date.now().toString(HASH_CONSTANTS.BASE_36)}-${rnd}`;
}

export function isDeepenButtonMarkup(line: string): boolean {
  return RegexHelpers.isDeepenButtonMarkup(line);
}

export function isMoodAnalyzeButtonMarkup(line: string): boolean {
  return RegexHelpers.isMoodAnalyzeButtonMarkup(line);
}

export function isNoteScopedDeepenMarkup(line: string): boolean {
  return RegexHelpers.isNoteScopedDeepenMarkup(line);
}

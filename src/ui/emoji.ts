// Small decorations for the wish cards, the star labels and the letter. Pure display: they are NOT part of anyone's words (content stays exactly as given), they are aria-hidden
// wherever they are drawn, and there is at most one per place so nothing looks crowded.
const WISH_EMOJI: Record<string, string> = {
  strawberry: '🍓',
  bumblebee: '🐝',
  rose: '🌹',
  'kaaju-katli': '💎',
  'cutie-patootie': '🥰',
};
export const LETTER_TOP_EMOJI = '💌';
export const LETTER_END_EMOJI = '✨';
export function emojiFor(id: string): string {
  return WISH_EMOJI[id] ?? '✨';
}

/**
 * App fonts (D58): Google Sans for the UI (as in Google Keep) and Google Sans Code for the
 * monospace Daily Log. Both are SIL OFL 1.1. Android doesn't synthesise weights for custom
 * fonts, so each weight is its own family; `fontForWeight` picks it.
 */
export const FONT = {
  regular: 'GoogleSans_400Regular',
  medium: 'GoogleSans_500Medium',
  semibold: 'GoogleSans_600SemiBold',
  bold: 'GoogleSans_700Bold',
} as const;

export const MONO_FONT = 'GoogleSansCode_400Regular';

type Weight = string | number | undefined;

/** Maps a React Native `fontWeight` to the Google Sans family that has that weight. */
export function fontForWeight(weight: Weight): string {
  const w = weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : Number(weight);
  if (!Number.isFinite(w) || w < 500) return FONT.regular;
  if (w < 600) return FONT.medium;
  if (w < 700) return FONT.semibold;
  return FONT.bold;
}

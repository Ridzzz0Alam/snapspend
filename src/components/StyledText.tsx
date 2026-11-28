import { Text, TextProps } from './Themed';
import { MONO_FONT } from '@/constants/fonts';

export function MonoText(props: TextProps) {
  return <Text {...props} style={[props.style, { fontFamily: MONO_FONT }]} />;
}

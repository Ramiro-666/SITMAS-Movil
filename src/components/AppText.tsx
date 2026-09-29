import { forwardRef } from 'react';
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextProps,
  type TextInputProps,
  type TextStyle,
  type StyleProp,
} from 'react-native';

const families: Record<string, string> = {
  '400': 'MavenPro_400Regular',
  '500': 'MavenPro_500Medium',
  '600': 'MavenPro_600SemiBold',
  '700': 'MavenPro_700Bold',
  '800': 'MavenPro_800ExtraBold',
  '900': 'MavenPro_900Black',
};

function fontStyle(style: StyleProp<TextStyle>): TextStyle {
  const flattened = StyleSheet.flatten(style);
  // Preserve explicit font families, such as monospace for code.
  if (flattened?.fontFamily) return {};
  const weight = flattened?.fontWeight;
  return {
    fontFamily:
      families[weight === 'bold' ? '700' : String(weight)] ?? families['400'],
    fontWeight: 'normal',
  };
}

export const Text = forwardRef<NativeText, TextProps>(function AppText(
  { style, ...props },
  ref,
) {
  return <NativeText ref={ref} {...props} style={[style, fontStyle(style)]} />;
});

export const TextInput = forwardRef<NativeTextInput, TextInputProps>(
  function AppTextInput({ style, ...props }, ref) {
    return (
      <NativeTextInput ref={ref} {...props} style={[style, fontStyle(style)]} />
    );
  },
);

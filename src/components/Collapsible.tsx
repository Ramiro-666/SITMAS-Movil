import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, View } from 'react-native';

export default function Collapsible({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  const [present, setPresent] = useState(open);
  const [height, setHeight] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const animatedHeight = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (open) setPresent(true);
    const animation = Animated.timing(animatedHeight, {
      toValue: open ? height : 0,
      duration: reduceMotion ? 0 : 200,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished && !open) setPresent(false);
    });
    return () => animation.stop();
  }, [open, height, animatedHeight, reduceMotion]);
  return (
    <Animated.View
      style={{ height: animatedHeight, overflow: 'hidden' }}
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      aria-hidden={!open}
    >
      <View
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
      >
        {present && children}
      </View>
    </Animated.View>
  );
}

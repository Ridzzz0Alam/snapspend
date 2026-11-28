/**
 * Full-screen receipt image viewer: pinch to zoom (1–6×), drag when zoomed, double-tap to zoom
 * in / reset. Swipe between pages with the arrows. Built on gesture-handler + reanimated.
 */
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from './Themed';

const MAX_SCALE = 6;

function ZoomableImage({ uri, label }: { uri: string; label: string }) {
  const { width, height } = useWindowDimensions();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const clampScale = (s: number) => {
    'worklet';
    return Math.min(MAX_SCALE, Math.max(1, s));
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clampScale(savedScale.value * e.scale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value === 1) {
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > 1 ? 1 : 2.5;
      scale.value = withTiming(next);
      savedScale.value = next;
      tx.value = withTiming(0);
      ty.value = withTiming(0);
      savedTx.value = 0;
      savedTy.value = 0;
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
      <Animated.View style={[{ width, height: height - 120 }, style]}>
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          accessibilityLabel={label}
        />
      </Animated.View>
    </GestureDetector>
  );
}

export function ImageViewer({
  uris,
  index,
  onClose,
}: {
  uris: readonly string[];
  index: number | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(index ?? 0);
  const [lastIndex, setLastIndex] = useState(index);
  if (index !== lastIndex) {
    setLastIndex(index);
    if (index != null) setPage(index);
  }
  const uri = uris[page];

  return (
    <Modal visible={index != null && !!uri} onRequestClose={onClose} animationType="fade">
      <GestureHandlerRootView style={styles.root}>
        <View style={[styles.bar, { paddingTop: insets.top + 4 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={styles.barButton}
          >
            <Text style={styles.barText}>✕ Close</Text>
          </Pressable>
          {uris.length > 1 && (
            <View style={styles.pager}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous page"
                disabled={page === 0}
                onPress={() => setPage((p) => p - 1)}
                style={[styles.barButton, page === 0 && styles.dim]}
              >
                <Text style={styles.barText}>‹</Text>
              </Pressable>
              <Text style={styles.barText}>
                {page + 1} / {uris.length}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next page"
                disabled={page === uris.length - 1}
                onPress={() => setPage((p) => p + 1)}
                style={[styles.barButton, page === uris.length - 1 && styles.dim]}
              >
                <Text style={styles.barText}>›</Text>
              </Pressable>
            </View>
          )}
        </View>
        {uri ? <ZoomableImage key={uri} uri={uri} label={`Receipt page ${page + 1}`} /> : null}
        <Text style={styles.hint}>Pinch to zoom · double-tap to zoom in or reset</Text>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 8,
    backgroundColor: '#000',
    zIndex: 1,
  },
  pager: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#000' },
  barButton: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barText: { color: '#fff', fontSize: 18 },
  dim: { opacity: 0.3 },
  hint: { color: '#aaa', textAlign: 'center', fontSize: 12, padding: 8 },
});

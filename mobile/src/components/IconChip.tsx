import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import {
  ACCENTS,
  ICONS,
  ICON_ON_FILLED,
  staggerDelay,
  tint,
  type Accent,
  type IconName,
} from '../theme/icons';
import {
  reducedMotionIfKnown,
  useReducedMotion,
} from '../hooks/useReducedMotion';

const STROKE = 1.75;
const EASE_OUT = Easing.out(Easing.quad);

/** A bare registry icon — decorative, hidden from screen readers. */
export function Icon({
  name,
  size = 18,
  color,
}: {
  name: IconName;
  size?: number;
  color: string;
}) {
  const Glyph = ICONS[name];
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      testID={`icon-${name}`}
    >
      <Glyph size={size} color={color} strokeWidth={STROKE} />
    </View>
  );
}

/**
 * Duotone chip: accent-tinted tile, accent stroke. `active` = filled chip
 * (solid accent, dark stroke) with one gentle pulse when it turns active.
 * `pressed` = lift 1.5px + icon scale 1.08 (driven by the parent control's
 * onPressIn/onPressOut). `tone` overrides colours for chips that sit on a
 * solid button. All motion is skipped when the OS asks for reduced motion.
 */
export default function IconChip({
  name,
  accent = 'brand',
  size = 24,
  active = false,
  pressed = false,
  tone,
}: {
  name: IconName;
  accent?: Accent;
  size?: number;
  active?: boolean;
  pressed?: boolean;
  tone?: { fg: string; bg: string };
}) {
  const reduced = useReducedMotion();
  const press = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const wasActive = useRef(active);

  useEffect(() => {
    if (reduced) {
      press.setValue(0);
      return;
    }
    Animated.timing(press, {
      toValue: pressed ? 1 : 0,
      duration: 160,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();
  }, [pressed, reduced, press]);

  useEffect(() => {
    if (active && !wasActive.current && !reduced) {
      pulse.setValue(1);
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.12,
          duration: 180,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 220,
          easing: EASE_OUT,
          useNativeDriver: true,
        }),
      ]).start();
    }
    wasActive.current = active;
  }, [active, reduced, pulse]);

  const color = ACCENTS[accent];
  const fg = tone ? tone.fg : active ? ICON_ON_FILLED : color;
  const bg = tone ? tone.bg : active ? color : tint(color, 0.16);
  const motion = reduced
    ? undefined
    : {
        transform: [
          {
            translateY: press.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -1.5],
            }),
          },
          { scale: pulse },
        ],
      };
  const glyphMotion = reduced
    ? undefined
    : {
        transform: [
          {
            scale: press.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.08],
            }),
          },
        ],
      };

  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      testID={`chip-${name}`}
      style={[
        styles.chip,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.3),
          backgroundColor: bg,
        },
        pressed && !reduced && !tone ? glowFor(color) : null,
        motion,
      ]}
    >
      <Animated.View style={glyphMotion}>
        <Icon name={name} size={Math.round(size * 0.6)} color={fg} />
      </Animated.View>
    </Animated.View>
  );
}

function glowFor(color: string): ViewStyle {
  return {
    shadowColor: color,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  };
}

/**
 * A full-width action button with a leading icon chip. Keeps the label as
 * its own <Text> node (Maestro/E2E taps by that exact text) and the same
 * overall height as the text-only buttons it replaces.
 */
export function ChipButton({
  icon,
  accent,
  label,
  onPress,
  disabled,
  style,
  textStyle,
  chipTone,
  loading,
  spinnerColor,
  numberOfLines,
  accessibilityLabel,
  compact = false,
}: {
  icon: IconName;
  accent: Accent;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  chipTone?: { fg: string; bg: string };
  loading?: boolean;
  spinnerColor?: string;
  numberOfLines?: number;
  accessibilityLabel?: string;
  /** Half-width buttons: smaller chip + gap so long ml/ta labels keep room. */
  compact?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <TouchableOpacity
      style={[styles.button, compact && styles.buttonCompact, style]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {loading ? (
        <Spinner color={spinnerColor || ACCENTS[accent]} />
      ) : (
        <>
          <IconChip
            name={icon}
            accent={accent}
            pressed={pressed}
            tone={chipTone}
            size={compact ? 20 : 24}
          />
          <Text
            style={[styles.buttonText, textStyle]}
            numberOfLines={numberOfLines}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

/**
 * Lucide `loader-circle`, spinning while something loads (replaces
 * ActivityIndicator). Under reduced motion it is shown still.
 */
export function Spinner({
  color,
  size = 'small',
  style,
}: {
  color: string;
  size?: 'small' | 'large';
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, spin]);

  const px = size === 'large' ? 36 : 20;
  return (
    <View
      style={[styles.spinner, style]}
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      testID="spinner"
    >
      <Animated.View
        style={
          reduced
            ? undefined
            : {
                transform: [
                  {
                    rotate: spin.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    }),
                  },
                ],
              }
        }
      >
        <Icon name="loading" size={px} color={color} />
      </Animated.View>
    </View>
  );
}

/**
 * Tile/card entrance: fade + 4px rise, staggered 40ms per item (capped at
 * 280ms). Renders fully visible immediately under reduced motion, and
 * never delays touch handling (the content is mounted from the start).
 */
export function RiseIn({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  // Animate only when motion was already known to be allowed at mount:
  // if the OS answer is still pending, show the tile at once rather than
  // hide it and fade it in later (no flicker, nothing delayed).
  const animate = useRef(reducedMotionIfKnown() === false).current;
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate || reduced) {
      progress.setValue(1);
      return;
    }
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 280,
      delay: staggerDelay(index),
      easing: EASE_OUT,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [animate, reduced, index, progress]);

  if (!animate || reduced) {
    return <View>{children}</View>;
  }
  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [4, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', justifyContent: 'center' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonCompact: { gap: 6 },
  buttonText: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  spinner: { alignItems: 'center', justifyContent: 'center' },
});

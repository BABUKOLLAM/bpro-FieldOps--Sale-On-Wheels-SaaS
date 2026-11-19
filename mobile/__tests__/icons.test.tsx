/**
 * Icon-refresh guards (Nov 2026): every icon comes from the registry,
 * no emoji/glyph icons remain in the home menu / PIN pad / labels, and
 * the OS reduce-motion setting switches the motion off.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { AccessibilityInfo, Animated } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import IconChip, { RiseIn, Spinner } from '../src/components/IconChip';
import { __resetReducedMotionCache } from '../src/hooks/useReducedMotion';
import { ACCENTS, ICONS, staggerDelay } from '../src/theme/icons';

const SRC = path.join(__dirname, '..', 'src');

function walk(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return fs.statSync(full).isDirectory() ? walk(full) : [full];
  });
}
const TSX = walk(SRC).filter((f) => f.endsWith('.tsx'));

function setReduceMotion(value: boolean) {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(value);
}

async function render(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(el);
  });
  // let the isReduceMotionEnabled promise settle and re-render
  await act(async () => {});
  return tree;
}

afterEach(() => {
  jest.restoreAllMocks();
  __resetReducedMotionCache();
});

describe('icon registry', () => {
  test('every icon name used in the app exists in ICONS', () => {
    const used = new Set<string>();
    const patterns = [
      /<(?:IconChip|Icon)\b[^>]*?\bname="([A-Za-z]+)"/g,
      /\bicon="([A-Za-z]+)"/g,
    ];
    for (const file of TSX) {
      const src = fs.readFileSync(file, 'utf8');
      for (const re of patterns) {
        for (const m of src.matchAll(re)) {
          used.add(m[1]);
        }
      }
    }
    expect(used.size).toBeGreaterThan(10);
    expect([...used].filter((n) => !(n in ICONS))).toEqual([]);
    for (const glyph of Object.values(ICONS)) {
      expect(glyph).toBeTruthy();
    }
  });

  test('every accent used exists', () => {
    for (const file of TSX) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/accent="([a-z]+)"/g)) {
        expect(Object.keys(ACCENTS)).toContain(m[1]);
      }
    }
  });

  test('no emoji or glyph icons left in screens or labels', () => {
    const glyph =
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}▲▼☰✕✖⌫]/u;
    const offenders: string[] = [];
    for (const file of [...TSX, path.join(SRC, 'i18n', 'locales.ts')]) {
      const src = fs.readFileSync(file, 'utf8');
      // strip comments so prose like "qty × rate" in a comment is fine
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      if (glyph.test(code)) {
        offenders.push(path.relative(SRC, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  test('stagger is 40ms per item, capped at 280ms', () => {
    expect([0, 1, 7, 20].map(staggerDelay)).toEqual([0, 40, 280, 280]);
  });
});

describe('reduced motion', () => {
  test('IconChip carries no transform when the OS asks for reduced motion', async () => {
    setReduceMotion(true);
    const timing = jest.spyOn(Animated, 'timing');
    const tree = await render(<IconChip name="sync" pressed active />);
    const chip = tree.root.findByProps({ testID: 'chip-sync' });
    const flat = [chip.props.style].flat(5).filter(Boolean);
    expect(flat.some((s: any) => s.transform)).toBe(false);
    expect(timing).not.toHaveBeenCalled();
  });

  test('IconChip animates the press lift when motion is allowed', async () => {
    setReduceMotion(false);
    const tree = await render(<IconChip name="sync" />);
    const timing = jest.spyOn(Animated, 'timing');
    await act(async () => {
      tree.update(<IconChip name="sync" pressed />);
    });
    const chip = tree.root.findByProps({ testID: 'chip-sync' });
    const flat = [chip.props.style].flat(5).filter(Boolean);
    expect(flat.some((s: any) => s.transform)).toBe(true);
    expect(timing).toHaveBeenCalled();
    await act(async () => {
      tree.unmount();
    });
  });

  test('Spinner does not loop under reduced motion', async () => {
    setReduceMotion(true);
    const loop = jest.spyOn(Animated, 'loop');
    await render(<Spinner color="#fff" />);
    expect(loop).not.toHaveBeenCalled();
  });

  test('RiseIn renders content plainly (no fade) under reduced motion', async () => {
    setReduceMotion(true);
    const tree = await render(
      <RiseIn index={3}>
        <IconChip name="visit" />
      </RiseIn>
    );
    const json = JSON.stringify(tree.toJSON());
    expect(json).not.toContain('"opacity":0');
    expect(json).not.toContain('translateY');
  });
});

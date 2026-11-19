import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ACCENTS, ICONS } from "../src/components/icons/registry";

/** Icon-refresh guards (Nov 2026): every icon comes from the registry,
 * no emoji/glyph icons are left in the chrome, and reduced motion turns
 * the motion off. Static source checks — no browser needed. */

const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const TSX = walk(SRC).filter((f) => f.endsWith(".tsx"));
const read = (f: string) => readFileSync(f, "utf8");

test("every icon name used in the UI exists in the registry", () => {
  const used = new Set<string>();
  const patterns = [
    /<(?:IconChip|Icon)\b[^>]*?\bname="([A-Za-z]+)"/g,
    /\bicon(?:=|: )"([A-Za-z]+)"/g,
  ];
  for (const file of TSX) {
    const src = read(file);
    for (const re of patterns) for (const m of src.matchAll(re)) used.add(m[1]);
  }
  expect(used.size).toBeGreaterThan(20);
  const missing = [...used].filter((n) => !(n in ICONS));
  expect(missing, `not in ICONS: ${missing.join(", ")}`).toEqual([]);
  for (const [name, glyph] of Object.entries(ICONS)) {
    expect(glyph, name).toBeTruthy();
  }
});

test("every accent used has light and dark tokens", () => {
  const css = read(join(SRC, "app/globals.css"));
  const rootBlock = css.slice(css.indexOf("Icon system"));
  for (const accent of ACCENTS) {
    const decls = rootBlock.match(new RegExp(`--ic-${accent}:`, "g")) || [];
    expect(decls.length, `--ic-${accent} light+dark`).toBe(2);
    expect(css).toContain(`[data-accent="${accent}"]`);
  }
  for (const file of TSX) {
    for (const m of read(file).matchAll(/accent(?:=|: )"([a-z]+)"/g)) {
      expect(ACCENTS as readonly string[], `${relative(ROOT, file)} uses ${m[1]}`).toContain(m[1]);
    }
  }
});

test("no emoji or text-glyph icons, no hand-drawn svg icons", () => {
  // Emoji + dingbats + the glyphs commonly used as fake icons.
  const glyph = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}▲▼☰✕✖⌫×]/u;
  const offenders: string[] = [];
  for (const file of TSX) {
    const rel = relative(ROOT, file);
    const src = read(file);
    // JSX text only (between > and <), so data/strings in logic don't trip it.
    for (const m of src.matchAll(/>([^<>{}]*)</g)) {
      if (glyph.test(m[1])) offenders.push(`${rel}: ${m[1].trim()}`);
    }
    // Inline <svg> icons are replaced by the registry (BrandLogo is artwork).
    if (/<svg\b/.test(src) && !rel.endsWith("BrandLogo.tsx")) offenders.push(`${rel}: inline <svg>`);
  }
  const locales = read(join(SRC, "i18n/locales.ts"));
  if (/[←✓✔]/.test(locales)) offenders.push("i18n/locales.ts: arrow/check glyph in a label");
  expect(offenders).toEqual([]);
});

test("prefers-reduced-motion switches every icon motion off", () => {
  const css = read(join(SRC, "app/globals.css"));
  const start = css.indexOf("@media (prefers-reduced-motion: reduce)");
  expect(start).toBeGreaterThan(-1);
  const block = css.slice(start, css.indexOf("\n}\n", start));
  for (const sel of [".ic-chip", ".ic-chip > svg", ".ic-rise", ".ic-spin", ".ic-glyph", ".ic-host:hover .ic-chip"]) {
    expect(block, sel).toContain(sel);
  }
  expect(block).toContain("transition: none !important");
  expect(block).toContain("animation: none !important");
  expect(block).toContain("transform: none !important");
  // Stagger is capped (<= 7 steps of 40ms) and nothing but the spinner loops.
  expect(css).toMatch(/min\(var\(--ic-i, 0\), 7\) \* 40ms/);
  const loops = css.match(/infinite/g) || [];
  expect(loops.length).toBe(1);
  expect(css).toMatch(/\.ic-spin \{ animation: ic-spin [^}]*infinite/);
});

/**
 * Minimal-training UI (BRD NFR: large touch targets, simple navigation,
 * suited to field staff with varying tech comfort) — a small, high-
 * contrast palette rather than a full design system.
 */
export const colors = {
  background: '#0a0a0a',
  surface: '#171717',
  border: '#404040',
  textPrimary: '#fafafa',
  textSecondary: '#a3a3a3',
  primary: '#f59e0b',
  // Amber-500 is too light for white text to clear WCAG contrast — pair
  // primary-colored buttons with this dark token instead of a hardcoded '#fff'.
  onPrimary: '#0a0a0a',
  success: '#10b981',
  warning: '#ea580c',
  danger: '#ef4444',
};
